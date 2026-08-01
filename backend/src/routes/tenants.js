const express = require("express");
const { ObjectId } = require("mongodb");

const { TenantCreate, TenantUpdate } = require("../validation/schemas");
const { validateBody } = require("../middleware/validate");
const { tenantsCol, roomsCol, usersCol } = require("../database");
const { requireOwner, requireTenant, hashPassword } = require("../auth");
const { serialize, serializeList, toObjectId } = require("../utils/helpers");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");

const router = express.Router();

async function attachRoomNames(tenants) {
  const roomIds = [...new Set(tenants.filter((t) => t.room_id).map((t) => String(t.room_id)))].map(
    (id) => new ObjectId(id)
  );
  const rooms = {};
  if (roomIds.length) {
    const cursor = roomsCol.find({ _id: { $in: roomIds } });
    for await (const r of cursor) {
      rooms[String(r._id)] = r.name;
    }
  }
  for (const t of tenants) {
    t.room_name = t.room_id ? rooms[String(t.room_id)] : undefined;
  }
  return tenants;
}

// IMPORTANT: '/me' must be declared before '/:tenantId' so it isn't
// swallowed by the parameterized route (mirrors FastAPI's route ordering).
router.get(
  "/me",
  requireTenant,
  asyncHandler(async (req, res) => {
    const tenant = await tenantsCol.findOne({ _id: new ObjectId(req.user.tenant_id) });
    if (!tenant) {
      throw new HttpError(404, "Tenant profile not found");
    }
    const tenants = await attachRoomNames([tenant]);
    res.json(serialize(tenants[0]));
  })
);

router.get(
  "",
  requireOwner,
  asyncHandler(async (req, res) => {
    let tenants = await tenantsCol.find().sort({ created_at: -1 }).limit(1000).toArray();
    tenants = await attachRoomNames(tenants);
    res.json(serializeList(tenants));
  })
);

router.post(
  "",
  requireOwner,
  validateBody(TenantCreate),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const existing = await tenantsCol.findOne({ email: payload.email.toLowerCase() });
    if (existing) {
      throw new HttpError(400, "A tenant with this email already exists");
    }

    const { set_password, ...rest } = payload;
    const doc = { ...rest };
    doc.email = doc.email.toLowerCase();
    doc.status = "active";
    doc.created_at = new Date();
    if (doc.room_id) {
      if (!ObjectId.isValid(doc.room_id)) {
        throw new HttpError(400, "Invalid room id");
      }
      doc.room_id = new ObjectId(doc.room_id);
    }

    const result = await tenantsCol.insertOne(doc);

    if (doc.room_id) {
      await roomsCol.updateOne({ _id: doc.room_id }, { $set: { status: "occupied" } });
    }

    if (set_password) {
      const existingUser = await usersCol.findOne({ email: doc.email });
      if (!existingUser) {
        await usersCol.insertOne({
          name: payload.name,
          email: doc.email,
          password_hash: await hashPassword(set_password),
          role: "tenant",
          tenant_id: result.insertedId,
          created_at: new Date(),
        });
      }
    }

    const tenant = await tenantsCol.findOne({ _id: result.insertedId });
    res.json(serialize(tenant));
  })
);

router.put(
  "/:tenantId",
  requireOwner,
  validateBody(TenantUpdate),
  asyncHandler(async (req, res) => {
    const oid = toObjectId(req.params.tenantId);
    const tenant = await tenantsCol.findOne({ _id: oid });
    if (!tenant) {
      throw new HttpError(404, "Tenant not found");
    }

    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([, v]) => v !== null && v !== undefined)
    );
    const oldRoomId = tenant.room_id || null;
    let newRoomId = null;
    if ("room_id" in updates) {
      if (!ObjectId.isValid(updates.room_id)) {
        throw new HttpError(400, "Invalid room id");
      }
      newRoomId = new ObjectId(updates.room_id);
      updates.room_id = newRoomId;
    }

    if (Object.keys(updates).length > 0) {
      await tenantsCol.updateOne({ _id: oid }, { $set: updates });
    }

    // Keep room occupancy status in sync
    if (newRoomId && (!oldRoomId || String(newRoomId) !== String(oldRoomId))) {
      await roomsCol.updateOne({ _id: newRoomId }, { $set: { status: "occupied" } });
      if (oldRoomId) {
        const remaining = await tenantsCol.countDocuments({ room_id: oldRoomId, status: "active" });
        if (remaining === 0) {
          await roomsCol.updateOne({ _id: oldRoomId }, { $set: { status: "vacant" } });
        }
      }
    }

    if (updates.status === "vacated" && oldRoomId) {
      const remaining = await tenantsCol.countDocuments({ room_id: oldRoomId, status: "active" });
      if (remaining === 0) {
        await roomsCol.updateOne({ _id: oldRoomId }, { $set: { status: "vacant" } });
      }
    }

    const updated = await tenantsCol.findOne({ _id: oid });
    res.json(serialize(updated));
  })
);

router.delete(
  "/:tenantId",
  requireOwner,
  asyncHandler(async (req, res) => {
    const oid = toObjectId(req.params.tenantId);
    const tenant = await tenantsCol.findOne({ _id: oid });
    if (!tenant) {
      throw new HttpError(404, "Tenant not found");
    }
    await tenantsCol.deleteOne({ _id: oid });
    await usersCol.deleteMany({ tenant_id: oid });
    if (tenant.room_id) {
      const remaining = await tenantsCol.countDocuments({ room_id: tenant.room_id, status: "active" });
      if (remaining === 0) {
        await roomsCol.updateOne({ _id: tenant.room_id }, { $set: { status: "vacant" } });
      }
    }
    res.json({ deleted: true });
  })
);

module.exports = router;

const express = require("express");
const { Types } = require("mongoose");

const { RequestCreate, RequestUpdate } = require("../validation/schemas");
const { validateBody } = require("../middleware/validate");
const { MaintenanceRequest, Tenant } = require("../database");
const { requireOwner, requireTenant, getCurrentUser } = require("../auth");
const { serialize, serializeList, toObjectId } = require("../utils/helpers");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");

const { ObjectId } = Types;
const router = express.Router();

router.post(
  "",
  requireTenant,
  validateBody(RequestCreate),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const tenant = await Tenant.findById(req.user.tenant_id).lean();
    const doc = await MaintenanceRequest.create({
      tenant_id: new ObjectId(req.user.tenant_id),
      room_id: tenant ? tenant.room_id || null : null,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      status: "open",
      owner_note: null,
      resolved_at: null,
    });
    res.json(serialize(doc.toObject()));
  })
);

router.get(
  "",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const query = {};
    if (req.user.role === "tenant") {
      query.tenant_id = new ObjectId(req.user.tenant_id);
    }
    const reqs = await MaintenanceRequest.find(query).sort({ created_at: -1 }).limit(1000).lean();

    const tenantIds = [...new Set(reqs.map((r) => String(r.tenant_id)))].map((id) => new ObjectId(id));
    const tenants = {};
    if (tenantIds.length) {
      const found = await Tenant.find({ _id: { $in: tenantIds } }).lean();
      for (const t of found) {
        tenants[String(t._id)] = t.name;
      }
    }
    for (const r of reqs) {
      r.tenant_name = tenants[String(r.tenant_id)];
    }

    res.json(serializeList(reqs));
  })
);

router.put(
  "/:requestId",
  requireOwner,
  validateBody(RequestUpdate),
  asyncHandler(async (req, res) => {
    const oid = toObjectId(req.params.requestId);
    const payload = req.body;
    const updates = { status: payload.status };
    if (payload.owner_note !== null && payload.owner_note !== undefined) {
      updates.owner_note = payload.owner_note;
    }
    if (payload.status === "resolved") {
      updates.resolved_at = new Date();
    }
    const result = await MaintenanceRequest.updateOne({ _id: oid }, { $set: updates });
    if (result.matchedCount === 0) {
      throw new HttpError(404, "Request not found");
    }
    const reqDoc = await MaintenanceRequest.findById(oid).lean();
    res.json(serialize(reqDoc));
  })
);

module.exports = router;

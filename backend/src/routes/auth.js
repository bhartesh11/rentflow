const express = require("express");
const { ObjectId } = require("mongodb");

const { LoginRequest, TenantRegisterRequest } = require("../validation/schemas");
const { validateBody } = require("../middleware/validate");
const { usersCol, tenantsCol, roomsCol } = require("../database");
const {
  hashPassword,
  verifyPassword,
  createAccessToken,
  getCurrentUser,
} = require("../auth");
const { serialize } = require("../utils/helpers");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");

const router = express.Router();

function tokenResponse({ accessToken, role, name, userId, tenantId = null }) {
  return {
    access_token: accessToken,
    token_type: "bearer",
    role,
    name,
    user_id: userId,
    tenant_id: tenantId,
  };
}

router.post(
  "/login",
  validateBody(LoginRequest),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const user = await usersCol.findOne({ email: payload.email.toLowerCase() });
    if (!user || !(await verifyPassword(payload.password, user.password_hash))) {
      throw new HttpError(401, "Invalid email or password");
    }

    const tokenData = { sub: String(user._id), role: user.role };
    if (user.tenant_id) {
      tokenData.tenant_id = String(user.tenant_id);
    }

    const token = createAccessToken(tokenData);
    res.json(
      tokenResponse({
        accessToken: token,
        role: user.role,
        name: user.name,
        userId: String(user._id),
        tenantId: user.tenant_id ? String(user.tenant_id) : null,
      })
    );
  })
);

// Tenant 'Join' flow. invite_code = the room's id, shared by the owner so
// tenants land in the correct room. A tenant profile is created if one
// doesn't already exist for this email (e.g. owner pre-added them).
router.post(
  "/register",
  validateBody(TenantRegisterRequest),
  asyncHandler(async (req, res) => {
    const payload = req.body;

    const existingUser = await usersCol.findOne({ email: payload.email.toLowerCase() });
    if (existingUser) {
      throw new HttpError(400, "An account with this email already exists");
    }

    let room = null;
    if (payload.invite_code) {
      if (ObjectId.isValid(payload.invite_code)) {
        room = await roomsCol.findOne({ _id: new ObjectId(payload.invite_code) });
      }
      if (!room) {
        throw new HttpError(400, "Invalid invite code / room code");
      }
    }

    // If owner already pre-created a tenant record with this email, attach to it
    let tenantId;
    const existingTenant = await tenantsCol.findOne({ email: payload.email.toLowerCase() });
    if (existingTenant) {
      tenantId = existingTenant._id;
      const update = { name: payload.name, phone: payload.phone };
      if (room) update.room_id = room._id;
      await tenantsCol.updateOne({ _id: tenantId }, { $set: update });
    } else {
      const tenantDoc = {
        name: payload.name,
        email: payload.email.toLowerCase(),
        phone: payload.phone,
        room_id: room ? room._id : null,
        move_in_date: new Date().toISOString().slice(0, 10),
        status: "active",
        security_deposit: 0,
        created_at: new Date(),
      };
      const result = await tenantsCol.insertOne(tenantDoc);
      tenantId = result.insertedId;
    }

    if (room) {
      await roomsCol.updateOne({ _id: room._id }, { $set: { status: "occupied" } });
    }

    const userDoc = {
      name: payload.name,
      email: payload.email.toLowerCase(),
      password_hash: await hashPassword(payload.password),
      role: "tenant",
      tenant_id: tenantId,
      created_at: new Date(),
    };
    const result = await usersCol.insertOne(userDoc);

    const token = createAccessToken({
      sub: String(result.insertedId),
      role: "tenant",
      tenant_id: String(tenantId),
    });

    res.json(
      tokenResponse({
        accessToken: token,
        role: "tenant",
        name: payload.name,
        userId: String(result.insertedId),
        tenantId: String(tenantId),
      })
    );
  })
);

router.get(
  "/me",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    res.json(serialize(req.user));
  })
);

module.exports = router;

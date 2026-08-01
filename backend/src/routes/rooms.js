const express = require("express");

const { RoomCreate, RoomUpdate } = require("../validation/schemas");
const { validateBody } = require("../middleware/validate");
const { roomsCol, tenantsCol } = require("../database");
const { requireOwner } = require("../auth");
const { serialize, serializeList, toObjectId } = require("../utils/helpers");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");

const router = express.Router();

router.get(
  "",
  requireOwner,
  asyncHandler(async (req, res) => {
    const rooms = await roomsCol.find().sort({ name: 1 }).limit(1000).toArray();
    res.json(serializeList(rooms));
  })
);

router.post(
  "",
  requireOwner,
  validateBody(RoomCreate),
  asyncHandler(async (req, res) => {
    const doc = { ...req.body };
    doc.status = "vacant";
    doc.created_at = new Date();
    const result = await roomsCol.insertOne(doc);
    const room = await roomsCol.findOne({ _id: result.insertedId });
    res.json(serialize(room));
  })
);

router.put(
  "/:roomId",
  requireOwner,
  validateBody(RoomUpdate),
  asyncHandler(async (req, res) => {
    let oid;
    try {
      oid = toObjectId(req.params.roomId);
    } catch {
      throw new HttpError(400, "Invalid room id");
    }
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([, v]) => v !== null && v !== undefined)
    );
    if (Object.keys(updates).length === 0) {
      throw new HttpError(400, "No fields to update");
    }
    const result = await roomsCol.updateOne({ _id: oid }, { $set: updates });
    if (result.matchedCount === 0) {
      throw new HttpError(404, "Room not found");
    }
    const room = await roomsCol.findOne({ _id: oid });
    res.json(serialize(room));
  })
);

router.delete(
  "/:roomId",
  requireOwner,
  asyncHandler(async (req, res) => {
    const oid = toObjectId(req.params.roomId);
    const linked = await tenantsCol.countDocuments({ room_id: oid, status: "active" });
    if (linked > 0) {
      throw new HttpError(400, "Cannot delete a room with an active tenant assigned");
    }
    const result = await roomsCol.deleteOne({ _id: oid });
    if (result.deletedCount === 0) {
      throw new HttpError(404, "Room not found");
    }
    res.json({ deleted: true });
  })
);

module.exports = router;

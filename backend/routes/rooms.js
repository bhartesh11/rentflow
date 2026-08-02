const express = require('express');
const { Property, Room, Tenant, MeterReading } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

async function assertOwnsProperty(propertyId, ownerId) {
  return Property.findOne({ _id: propertyId, owner: ownerId });
}

async function assertOwnsRoom(roomId, ownerId) {
  const room = await Room.findById(roomId).populate('property').populate('tenant');
  if (!room || !room.property || String(room.property.owner) !== String(ownerId)) {
    return null;
  }
  return room;
}

// GET /api/rooms?propertyId=&status=
router.get(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { propertyId, status } = req.query;

    const ownedProperties = await Property.find({ owner: req.user.id }).select('_id');
    const ownedIds = ownedProperties.map((p) => p._id.toString());

    const filter = {};
    if (propertyId) {
      if (!ownedIds.includes(propertyId)) {
        return res.json({ rooms: [] });
      }
      filter.property = propertyId;
    } else {
      filter.property = { $in: ownedIds };
    }
    if (status) filter.occupancyStatus = status;

    const rooms = await Room.find(filter).populate('property').populate('tenant').sort({ createdAt: -1 });
    res.json({ rooms });
  })
);

// POST /api/rooms
router.post(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { propertyId, roomNumber, floor, rentAmount, depositAmount, capacity, notes } = req.body;
    if (!propertyId || !roomNumber || rentAmount == null || capacity == null) {
      return res
        .status(400)
        .json({ error: 'propertyId, roomNumber, rentAmount and capacity are required' });
    }

    const property = await assertOwnsProperty(propertyId, req.user.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const room = await Room.create({
      property: propertyId,
      roomNumber,
      floor,
      rentAmount: Number(rentAmount),
      depositAmount: depositAmount != null ? Number(depositAmount) : null,
      capacity: Number(capacity),
      notes,
    });
    res.status(201).json({ room });
  })
);

// GET /api/rooms/:id
router.get(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const room = await assertOwnsRoom(req.params.id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room });
  })
);

// PUT /api/rooms/:id
router.put(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await assertOwnsRoom(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Room not found' });

    const { roomNumber, floor, rentAmount, depositAmount, capacity, notes } = req.body;
    if (roomNumber !== undefined) existing.roomNumber = roomNumber;
    if (floor !== undefined) existing.floor = floor;
    if (rentAmount != null) existing.rentAmount = Number(rentAmount);
    if (depositAmount != null) existing.depositAmount = Number(depositAmount);
    if (capacity != null) existing.capacity = Number(capacity);
    if (notes !== undefined) existing.notes = notes;
    await existing.save();

    res.json({ room: existing });
  })
);

// DELETE /api/rooms/:id
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await assertOwnsRoom(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Room not found' });
    if (existing.tenant) {
      return res.status(400).json({ error: 'Vacate the room before deleting it' });
    }
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: 'Room deleted' });
  })
);

// POST /api/rooms/:id/assign - assign a tenant to a vacant room
router.post(
  '/:id/assign',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { tenantId, occupantsCount, initialMeterReading, initialMeterReadingDate } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

    const room = await assertOwnsRoom(req.params.id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.occupancyStatus === 'OCCUPIED') {
      return res.status(400).json({ error: 'Room is already occupied' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.assignedRoom) {
      return res.status(400).json({ error: 'Tenant is already assigned to a room' });
    }

    const occupants = occupantsCount != null && occupantsCount !== '' ? Number(occupantsCount) : 1;
    if (occupants < 1 || occupants > room.capacity) {
      return res
        .status(400)
        .json({ error: `Number of occupants must be between 1 and the room's capacity (${room.capacity})` });
    }

    room.tenant = tenantId;
    room.occupancyStatus = 'OCCUPIED';
    await room.save();

    tenant.status = 'ACTIVE';
    tenant.assignedRoom = req.params.id;
    tenant.occupantsCount = occupants;
    await tenant.save();

    // Record a baseline meter reading at move-in so the first real bill's "previous
    // reading" is accurate, rather than defaulting to 0.
    if (initialMeterReading != null && initialMeterReading !== '') {
      await MeterReading.create({
        room: req.params.id,
        previousReading: Number(initialMeterReading),
        currentReading: Number(initialMeterReading),
        unitsConsumed: 0,
        ratePerUnit: 0,
        amount: 0,
        readingMonth: initialMeterReadingDate ? new Date(initialMeterReadingDate) : new Date(),
        billed: true, // baseline only - never itself billed
      });
    }

    res.json({ room });
  })
);

// POST /api/rooms/:id/vacate - free up a room
router.post(
  '/:id/vacate',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const room = await assertOwnsRoom(req.params.id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const previousTenantId = room.tenant ? room.tenant._id || room.tenant : null;

    room.tenant = null;
    room.occupancyStatus = 'VACANT';
    await room.save();

    if (previousTenantId) {
      await Tenant.findByIdAndUpdate(previousTenantId, { status: 'VACATED', assignedRoom: null });
    }

    res.json({ room });
  })
);

// GET /api/rooms/:id/meter-readings - reading history for a room
router.get(
  '/:id/meter-readings',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const room = await assertOwnsRoom(req.params.id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const filter = { room: req.params.id };
    if (req.query.billed === 'false') filter.billed = false;
    if (req.query.billed === 'true') filter.billed = true;

    const meterReadings = await MeterReading.find(filter).sort({ readingMonth: -1 });
    res.json({ meterReadings });
  })
);

// POST /api/rooms/:id/meter-readings - owner logs a new electricity meter reading
// Automatically uses the last recorded reading as the "previous" value, computes units
// consumed and the electricity amount owed, ready to attach to a bill.
router.post(
  '/:id/meter-readings',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { currentReading, ratePerUnit, readingMonth } = req.body;

    if (currentReading == null || ratePerUnit == null || !readingMonth) {
      return res
        .status(400)
        .json({ error: 'currentReading, ratePerUnit and readingMonth are required' });
    }

    const room = await assertOwnsRoom(req.params.id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const lastReading = await MeterReading.findOne({ room: req.params.id }).sort({ readingMonth: -1 });
    const previousReading = lastReading ? lastReading.currentReading : 0;

    if (Number(currentReading) < previousReading) {
      return res.status(400).json({
        error: `Current reading (${currentReading}) cannot be less than the previous reading (${previousReading})`,
      });
    }

    const unitsConsumed = Math.round((Number(currentReading) - previousReading) * 100) / 100;
    const amount = Math.round(unitsConsumed * Number(ratePerUnit) * 100) / 100;

    const meterReading = await MeterReading.create({
      room: req.params.id,
      previousReading,
      currentReading: Number(currentReading),
      unitsConsumed,
      ratePerUnit: Number(ratePerUnit),
      amount,
      readingMonth: new Date(readingMonth),
    });
    res.status(201).json({ meterReading });
  })
);

module.exports = router;

const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

async function assertOwnsProperty(propertyId, ownerId) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, ownerId } });
  return property;
}

async function assertOwnsRoom(roomId, ownerId) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, property: { ownerId } },
    include: { property: true, tenant: true },
  });
  return room;
}

// GET /api/rooms?propertyId=&status=
router.get(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { propertyId, status } = req.query;
    const rooms = await prisma.room.findMany({
      where: {
        property: { ownerId: req.user.id },
        ...(propertyId ? { propertyId } : {}),
        ...(status ? { occupancyStatus: status } : {}),
      },
      include: { property: true, tenant: true },
      orderBy: { createdAt: 'desc' },
    });
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

    const room = await prisma.room.create({
      data: {
        propertyId,
        roomNumber,
        floor,
        rentAmount: Number(rentAmount),
        depositAmount: depositAmount != null ? Number(depositAmount) : null,
        capacity: Number(capacity),
        notes,
      },
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
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: {
        roomNumber,
        floor,
        rentAmount: rentAmount != null ? Number(rentAmount) : undefined,
        depositAmount: depositAmount != null ? Number(depositAmount) : undefined,
        capacity: capacity != null ? Number(capacity) : undefined,
        notes,
      },
    });
    res.json({ room });
  })
);

// DELETE /api/rooms/:id
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await assertOwnsRoom(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Room not found' });
    if (existing.tenantId) {
      return res.status(400).json({ error: 'Vacate the room before deleting it' });
    }
    await prisma.room.delete({ where: { id: req.params.id } });
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

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.assignedRoomId) {
      return res.status(400).json({ error: 'Tenant is already assigned to a room' });
    }

    const occupants = occupantsCount != null && occupantsCount !== '' ? Number(occupantsCount) : 1;
    if (occupants < 1 || occupants > room.capacity) {
      return res
        .status(400)
        .json({ error: `Number of occupants must be between 1 and the room's capacity (${room.capacity})` });
    }

    const tx = [
      prisma.room.update({
        where: { id: req.params.id },
        data: { tenantId, occupancyStatus: 'OCCUPIED' },
      }),
      prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE', assignedRoomId: req.params.id, occupantsCount: occupants },
      }),
    ];

    // Record a baseline meter reading at move-in so the first real bill's "previous
    // reading" is accurate, rather than defaulting to 0.
    if (initialMeterReading != null && initialMeterReading !== '') {
      tx.push(
        prisma.meterReading.create({
          data: {
            roomId: req.params.id,
            previousReading: Number(initialMeterReading),
            currentReading: Number(initialMeterReading),
            unitsConsumed: 0,
            ratePerUnit: 0,
            amount: 0,
            readingMonth: initialMeterReadingDate ? new Date(initialMeterReadingDate) : new Date(),
            billed: true, // baseline only - never itself billed
          },
        })
      );
    }

    const [updatedRoom] = await prisma.$transaction(tx);

    res.json({ room: updatedRoom });
  })
);

// POST /api/rooms/:id/vacate - free up a room
router.post(
  '/:id/vacate',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const room = await assertOwnsRoom(req.params.id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const tx = [
      prisma.room.update({
        where: { id: req.params.id },
        data: { tenantId: null, occupancyStatus: 'VACANT' },
      }),
    ];
    if (room.tenantId) {
      tx.push(
        prisma.tenant.update({
          where: { id: room.tenantId },
          data: { status: 'VACATED', assignedRoomId: null },
        })
      );
    }
    const [updatedRoom] = await prisma.$transaction(tx);
    res.json({ room: updatedRoom });
  })
);

// GET /api/rooms/:id/meter-readings - reading history for a room
router.get(
  '/:id/meter-readings',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const room = await assertOwnsRoom(req.params.id, req.user.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const where = { roomId: req.params.id };
    if (req.query.billed === 'false') where.billed = false;
    if (req.query.billed === 'true') where.billed = true;

    const meterReadings = await prisma.meterReading.findMany({
      where,
      orderBy: { readingMonth: 'desc' },
    });
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

    const lastReading = await prisma.meterReading.findFirst({
      where: { roomId: req.params.id },
      orderBy: { readingMonth: 'desc' },
    });
    const previousReading = lastReading ? lastReading.currentReading : 0;

    if (Number(currentReading) < previousReading) {
      return res.status(400).json({
        error: `Current reading (${currentReading}) cannot be less than the previous reading (${previousReading})`,
      });
    }

    const unitsConsumed = Math.round((Number(currentReading) - previousReading) * 100) / 100;
    const amount = Math.round(unitsConsumed * Number(ratePerUnit) * 100) / 100;

    const meterReading = await prisma.meterReading.create({
      data: {
        roomId: req.params.id,
        previousReading,
        currentReading: Number(currentReading),
        unitsConsumed,
        ratePerUnit: Number(ratePerUnit),
        amount,
        readingMonth: new Date(readingMonth),
      },
    });
    res.status(201).json({ meterReading });
  })
);

module.exports = router;

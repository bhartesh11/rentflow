const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

// GET /api/properties - list properties owned by the current owner
router.get(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id },
      include: { rooms: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ properties });
  })
);

// POST /api/properties - create a new property
router.post(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { name, address, city, state, pincode, description, numberOfRooms } = req.body;
    if (!name || !address || !city || !state || !pincode) {
      return res.status(400).json({ error: 'name, address, city, state and pincode are required' });
    }

    const roomCount = numberOfRooms != null && numberOfRooms !== '' ? Number(numberOfRooms) : 0;
    if (roomCount < 0 || roomCount > 500) {
      return res.status(400).json({ error: 'numberOfRooms must be between 0 and 500' });
    }

    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.property.create({
        data: { name, address, city, state, pincode, description, ownerId: req.user.id },
      });

      // Convenience: auto-generate the requested number of blank rooms so the
      // owner doesn't have to add each one by hand. They can edit rent/capacity after.
      if (roomCount > 0) {
        await tx.room.createMany({
          data: Array.from({ length: roomCount }, (_, i) => ({
            propertyId: created.id,
            roomNumber: String(101 + i),
            rentAmount: 0,
            capacity: 1,
          })),
        });
      }

      return tx.property.findUnique({ where: { id: created.id }, include: { rooms: true } });
    });

    res.status(201).json({ property });
  })
);

// GET /api/properties/:id
router.get(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      include: { rooms: { include: { tenant: true } } },
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json({ property });
  })
);

// PUT /api/properties/:id
router.put(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.property.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Property not found' });

    const { name, address, city, state, pincode, description, status } = req.body;
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: { name, address, city, state, pincode, description, status },
    });
    res.json({ property });
  })
);

// DELETE /api/properties/:id
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.property.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Property not found' });

    const roomCount = await prisma.room.count({ where: { propertyId: req.params.id } });
    if (roomCount > 0) {
      return res
        .status(400)
        .json({ error: 'Remove all rooms from this property before deleting it' });
    }

    await prisma.property.delete({ where: { id: req.params.id } });
    res.json({ message: 'Property deleted' });
  })
);

module.exports = router;

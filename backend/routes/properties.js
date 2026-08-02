const express = require('express');
const { Property, Room } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

// GET /api/properties - list properties owned by the current owner
router.get(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const properties = await Property.find({ owner: req.user.id })
      .populate('rooms')
      .sort({ createdAt: -1 });
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

    const created = await Property.create({
      name,
      address,
      city,
      state,
      pincode,
      description,
      owner: req.user.id,
    });

    // Convenience: auto-generate the requested number of blank rooms so the
    // owner doesn't have to add each one by hand. They can edit rent/capacity after.
    if (roomCount > 0) {
      await Room.insertMany(
        Array.from({ length: roomCount }, (_, i) => ({
          property: created._id,
          roomNumber: String(101 + i),
          rentAmount: 0,
          capacity: 1,
        }))
      );
    }

    const property = await Property.findById(created._id).populate('rooms');
    res.status(201).json({ property });
  })
);

// GET /api/properties/:id
router.get(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const property = await Property.findOne({ _id: req.params.id, owner: req.user.id }).populate({
      path: 'rooms',
      populate: { path: 'tenant' },
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
    const existing = await Property.findOne({ _id: req.params.id, owner: req.user.id });
    if (!existing) return res.status(404).json({ error: 'Property not found' });

    const { name, address, city, state, pincode, description, status } = req.body;
    if (name !== undefined) existing.name = name;
    if (address !== undefined) existing.address = address;
    if (city !== undefined) existing.city = city;
    if (state !== undefined) existing.state = state;
    if (pincode !== undefined) existing.pincode = pincode;
    if (description !== undefined) existing.description = description;
    if (status !== undefined) existing.status = status;
    await existing.save();

    res.json({ property: existing });
  })
);

// DELETE /api/properties/:id
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await Property.findOne({ _id: req.params.id, owner: req.user.id });
    if (!existing) return res.status(404).json({ error: 'Property not found' });

    const roomCount = await Room.countDocuments({ property: req.params.id });
    if (roomCount > 0) {
      return res
        .status(400)
        .json({ error: 'Remove all rooms from this property before deleting it' });
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ message: 'Property deleted' });
  })
);

module.exports = router;

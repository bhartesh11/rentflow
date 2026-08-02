const express = require('express');
const { Tenant, Room } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { buildTenantsXlsx, buildTenantsPdf } = require('../lib/tenantExport');

const router = express.Router();
router.use(authenticate);

// GET /api/tenants - owners see everyone, tenants see only their own profile
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'TENANT') {
      const tenants = await Tenant.find({ user: req.user.id }).populate({
        path: 'assignedRoom',
        populate: { path: 'property' },
      });
      return res.json({ tenants });
    }

    const { status } = req.query;
    const filter = status ? { status } : {};
    const tenants = await Tenant.find(filter)
      .populate({ path: 'assignedRoom', populate: { path: 'property' } })
      .sort({ createdAt: -1 });
    res.json({ tenants });
  })
);

// GET /api/tenants/export?ids=id1,id2&format=xlsx|pdf
// Exports selected tenants' details (contact, ID proof, room, occupants) - e.g. for
// handing over to local police for tenant verification, or general record-keeping.
router.get(
  '/export',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { ids, format } = req.query;
    if (!ids) return res.status(400).json({ error: 'ids query param is required (comma-separated tenant ids)' });
    if (!['xlsx', 'pdf'].includes(format)) {
      return res.status(400).json({ error: "format must be 'xlsx' or 'pdf'" });
    }

    const tenantIds = String(ids).split(',').filter(Boolean);
    const tenants = await Tenant.find({ _id: { $in: tenantIds } })
      .populate({ path: 'assignedRoom', populate: { path: 'property' } })
      .sort({ fullName: 1 });
    if (tenants.length === 0) return res.status(404).json({ error: 'No matching tenants found' });

    const filenameBase = `tenants-export-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'xlsx') {
      const buffer = await buildTenantsXlsx(tenants);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
      return res.send(buffer);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
    buildTenantsPdf(tenants, res);
  })
);

// GET /api/tenants/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id)
      .populate({ path: 'assignedRoom', populate: { path: 'property' } })
      .populate('bills')
      .populate('payments');
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (req.user.role === 'TENANT' && String(tenant.user) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You do not have permission to view this tenant' });
    }
    res.json({ tenant });
  })
);

// PUT /api/tenants/:id - owner edits tenant details, or tenant edits their own profile
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await Tenant.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });
    if (req.user.role === 'TENANT' && String(existing.user) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You do not have permission to edit this tenant' });
    }

    const {
      fullName,
      mobileNumber,
      address,
      aadhaarNumber,
      pan,
      emergencyContact,
      occupation,
      securityDeposit,
      status,
      occupantsCount,
    } = req.body;

    if (fullName !== undefined) existing.fullName = fullName;
    if (mobileNumber !== undefined) existing.mobileNumber = mobileNumber;
    if (address !== undefined) existing.address = address;
    if (aadhaarNumber !== undefined) existing.aadhaarNumber = aadhaarNumber;
    if (pan !== undefined) existing.pan = pan;
    if (emergencyContact !== undefined) existing.emergencyContact = emergencyContact;
    if (occupation !== undefined) existing.occupation = occupation;

    // Only owners may change status (approval / vacate), security deposit, or occupants
    if (req.user.role === 'OWNER') {
      if (status) existing.status = status;
      if (securityDeposit != null) existing.securityDeposit = Number(securityDeposit);
      if (occupantsCount != null) existing.occupantsCount = Number(occupantsCount);
    }

    await existing.save();
    res.json({ tenant: existing });
  })
);

// PUT /api/tenants/:id/approve - owner approves a pending tenant application
router.put(
  '/:id/approve',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await Tenant.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });

    existing.status = 'ACTIVE';
    existing.joiningDate = existing.joiningDate || new Date();
    await existing.save();

    res.json({ tenant: existing });
  })
);

// DELETE /api/tenants/:id
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await Tenant.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });

    if (existing.assignedRoom) {
      await Room.findByIdAndUpdate(existing.assignedRoom, { tenant: null, occupancyStatus: 'VACANT' });
    }
    await Tenant.findByIdAndDelete(req.params.id);
    res.json({ message: 'Tenant deleted' });
  })
);

module.exports = router;

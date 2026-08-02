const express = require('express');
const prisma = require('../lib/prisma');
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
      const tenants = await prisma.tenant.findMany({
        where: { userId: req.user.id },
        include: { assignedRoom: { include: { property: true } } },
      });
      return res.json({ tenants });
    }

    const { status } = req.query;
    const tenants = await prisma.tenant.findMany({
      where: status ? { status } : undefined,
      include: { assignedRoom: { include: { property: true } } },
      orderBy: { createdAt: 'desc' },
    });
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
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      include: { assignedRoom: { include: { property: true } } },
      orderBy: { fullName: 'asc' },
    });
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
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: { assignedRoom: { include: { property: true } }, bills: true, payments: true },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (req.user.role === 'TENANT' && tenant.userId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to view this tenant' });
    }
    res.json({ tenant });
  })
);

// PUT /api/tenants/:id - owner edits tenant details, or tenant edits their own profile
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });
    if (req.user.role === 'TENANT' && existing.userId !== req.user.id) {
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

    // Only owners may change status (approval / vacate), security deposit, or occupants
    const data = { fullName, mobileNumber, address, aadhaarNumber, pan, emergencyContact, occupation };
    if (req.user.role === 'OWNER') {
      if (status) data.status = status;
      if (securityDeposit != null) data.securityDeposit = Number(securityDeposit);
      if (occupantsCount != null) data.occupantsCount = Number(occupantsCount);
    }

    const tenant = await prisma.tenant.update({ where: { id: req.params.id }, data });
    res.json({ tenant });
  })
);

// PUT /api/tenants/:id/approve - owner approves a pending tenant application
router.put(
  '/:id/approve',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', joiningDate: existing.joiningDate || new Date() },
    });
    res.json({ tenant });
  })
);

// DELETE /api/tenants/:id
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });

    if (existing.assignedRoomId) {
      await prisma.room.update({
        where: { id: existing.assignedRoomId },
        data: { tenantId: null, occupancyStatus: 'VACANT' },
      });
    }
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.json({ message: 'Tenant deleted' });
  })
);

module.exports = router;

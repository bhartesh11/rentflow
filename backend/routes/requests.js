const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

// GET /api/requests
router.get(
  '/',
  asyncHandler(async (req, res) => {
    let where = {};
    if (req.user.role === 'TENANT') {
      const tenant = await prisma.tenant.findFirst({ where: { userId: req.user.id } });
      where = tenant ? { tenantId: tenant.id } : { userId: req.user.id };
    } else if (req.query.status) {
      where = { status: req.query.status };
    }

    const requests = await prisma.request.findMany({
      where,
      include: { tenant: true, user: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  })
);

// POST /api/requests - a tenant (or owner) raises a maintenance request
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, description, priority } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    let tenantId = null;
    if (req.user.role === 'TENANT') {
      const tenant = await prisma.tenant.findFirst({ where: { userId: req.user.id } });
      tenantId = tenant ? tenant.id : null;
    }

    const request = await prisma.request.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        tenantId,
        userId: req.user.id,
      },
    });
    res.status(201).json({ request });
  })
);

// PUT /api/requests/:id - owner updates status/priority
router.put(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.request.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Request not found' });

    const { status, priority } = req.body;
    const request = await prisma.request.update({
      where: { id: req.params.id },
      data: { status, priority },
    });
    res.json({ request });
  })
);

// DELETE /api/requests/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.request.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Request not found' });
    if (req.user.role === 'TENANT' && existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this request' });
    }
    await prisma.request.delete({ where: { id: req.params.id } });
    res.json({ message: 'Request deleted' });
  })
);

module.exports = router;

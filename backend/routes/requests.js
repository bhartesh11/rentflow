const express = require('express');
const { Request, Tenant } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

// GET /api/requests
router.get(
  '/',
  asyncHandler(async (req, res) => {
    let filter = {};
    if (req.user.role === 'TENANT') {
      const tenant = await Tenant.findOne({ user: req.user.id });
      filter = tenant ? { tenant: tenant._id } : { user: req.user.id };
    } else if (req.query.status) {
      filter = { status: req.query.status };
    }

    const requests = await Request.find(filter)
      .populate('tenant')
      .populate('user')
      .sort({ createdAt: -1 });
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
      const tenant = await Tenant.findOne({ user: req.user.id });
      tenantId = tenant ? tenant._id : null;
    }

    const request = await Request.create({
      title,
      description,
      priority: priority || 'MEDIUM',
      tenant: tenantId,
      user: req.user.id,
    });
    res.status(201).json({ request });
  })
);

// PUT /api/requests/:id - owner updates status/priority
router.put(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await Request.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Request not found' });

    const { status, priority } = req.body;
    if (status !== undefined) existing.status = status;
    if (priority !== undefined) existing.priority = priority;
    await existing.save();

    res.json({ request: existing });
  })
);

// DELETE /api/requests/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await Request.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Request not found' });
    if (req.user.role === 'TENANT' && String(existing.user) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You do not have permission to delete this request' });
    }
    await Request.findByIdAndDelete(req.params.id);
    res.json({ message: 'Request deleted' });
  })
);

module.exports = router;

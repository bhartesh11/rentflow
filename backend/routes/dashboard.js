const express = require('express');
const { Property, Room, Tenant, Payment, Request } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard/stats
router.get(
  '/stats',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const ownerId = req.user.id;

    const ownedProperties = await Property.find({ owner: ownerId }).select('_id');
    const propertyIds = ownedProperties.map((p) => p._id);

    const [totalProperties, rooms, totalTenants, pendingTenants] = await Promise.all([
      Property.countDocuments({ owner: ownerId }),
      Room.find({ property: { $in: propertyIds } }),
      Tenant.countDocuments({ status: 'ACTIVE' }),
      Tenant.countDocuments({ status: 'PENDING' }),
    ]);

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.occupancyStatus === 'OCCUPIED').length;
    const roomIds = rooms.map((r) => r._id);

    const tenantsInOwnedRooms = await Tenant.find({ assignedRoom: { $in: roomIds } }).select('_id');
    const tenantIds = tenantsInOwnedRooms.map((t) => t._id);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyPayments = await Payment.find({
      tenant: { $in: tenantIds },
      paymentDate: { $gte: startOfMonth },
    });
    const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);

    const recentPayments = await Payment.find({ tenant: { $in: tenantIds } })
      .populate('tenant')
      .populate({ path: 'bill', populate: { path: 'room' } })
      .sort({ paymentDate: -1 })
      .limit(10);

    const openRequests = await Request.countDocuments({ status: { $in: ['PENDING', 'IN_PROGRESS'] } });

    res.json({
      stats: {
        totalProperties,
        totalRooms,
        occupiedRooms,
        vacantRooms: totalRooms - occupiedRooms,
        totalTenants,
        pendingTenants,
        monthlyRevenue,
        openRequests,
      },
      recentPayments,
    });
  })
);

module.exports = router;

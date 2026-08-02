const express = require('express');
const prisma = require('../lib/prisma');
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

    const [totalProperties, rooms, totalTenants, pendingTenants] = await Promise.all([
      prisma.property.count({ where: { ownerId } }),
      prisma.room.findMany({ where: { property: { ownerId } } }),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'PENDING' } }),
    ]);

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((r) => r.occupancyStatus === 'OCCUPIED').length;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyPayments = await prisma.payment.findMany({
      where: { tenant: { assignedRoom: { property: { ownerId } } }, paymentDate: { gte: startOfMonth } },
    });
    const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);

    const recentPayments = await prisma.payment.findMany({
      where: { tenant: { assignedRoom: { property: { ownerId } } } },
      include: { tenant: true, bill: { include: { room: true } } },
      orderBy: { paymentDate: 'desc' },
      take: 10,
    });

    const openRequests = await prisma.request.count({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });

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

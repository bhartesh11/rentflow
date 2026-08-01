const express = require("express");

const { Room, Tenant, Bill, Payment } = require("../database");
const { requireOwner } = require("../auth");
const { serializeList } = require("../utils/helpers");
const { asyncHandler } = require("../utils/asyncHandler");

const router = express.Router();

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(year, month) {
  // month is 1-indexed here
  return `${year}-${String(month).padStart(2, "0")}`;
}

router.get(
  "/stats",
  requireOwner,
  asyncHandler(async (req, res) => {
    const totalRooms = await Room.countDocuments({});
    const occupiedRooms = await Room.countDocuments({ status: "occupied" });
    const activeTenants = await Tenant.countDocuments({ status: "active" });

    const today = todayIso();
    const thisMonth = today.slice(0, 7);
    const billsThisMonth = await Bill.find({ month: thisMonth }).limit(1000).lean();
    const totalBilled = billsThisMonth.reduce((s, b) => s + b.total_amount, 0);
    const totalCollectedThisMonth = billsThisMonth.reduce((s, b) => s + b.amount_paid, 0);

    const allUnpaid = await Bill.find({ $expr: { $lt: ["$amount_paid", "$total_amount"] } })
      .limit(2000)
      .lean();
    const totalDues = allUnpaid.reduce((s, b) => s + (b.total_amount - b.amount_paid), 0);
    const overdueCount = allUnpaid.filter((b) => b.due_date && b.due_date < today).length;

    const allPayments = await Payment.find().limit(5000).lean();
    const totalCollectedAllTime = allPayments.reduce((s, p) => s + p.amount, 0);

    // last 6 months collection trend
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      let year = now.getFullYear();
      let month = now.getMonth() + 1 - i; // JS months are 0-indexed; +1 to match Python's 1-indexed cursor.month
      while (month <= 0) {
        month += 12;
        year -= 1;
      }
      months.push(monthKey(year, month));
    }

    const trend = [];
    for (const m of months) {
      const monthBills = m === thisMonth ? billsThisMonth : await Bill.find({ month: m }).limit(1000).lean();
      trend.push({
        month: m,
        billed: monthBills.reduce((s, b) => s + b.total_amount, 0),
        collected: monthBills.reduce((s, b) => s + b.amount_paid, 0),
      });
    }

    const recentPayments = await Payment.find().sort({ created_at: -1 }).limit(5).lean();
    const tenantsMap = {};
    const found = await Tenant.find({}, { name: 1 }).lean();
    for (const t of found) {
      tenantsMap[String(t._id)] = t.name;
    }
    for (const p of recentPayments) {
      p.tenant_name = tenantsMap[String(p.tenant_id)];
    }

    res.json({
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      vacant_rooms: totalRooms - occupiedRooms,
      occupancy_rate: totalRooms ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0,
      active_tenants: activeTenants,
      total_billed_this_month: totalBilled,
      total_collected_this_month: totalCollectedThisMonth,
      total_dues: totalDues,
      overdue_bills: overdueCount,
      total_collected_all_time: totalCollectedAllTime,
      monthly_trend: trend,
      recent_payments: serializeList(recentPayments),
    });
  })
);

module.exports = router;

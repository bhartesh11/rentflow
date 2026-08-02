const express = require('express');
const { Bill, Tenant, MeterReading } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { buildBillPdf } = require('../lib/billPdf');

const router = express.Router();
router.use(authenticate);

function computeTotal({ rent, electricityCharges, waterCharges, maintenance, otherCharges, discounts, previousDue }) {
  const total =
    Number(rent || 0) +
    Number(electricityCharges || 0) +
    Number(waterCharges || 0) +
    Number(maintenance || 0) +
    Number(otherCharges || 0) +
    Number(previousDue || 0) -
    Number(discounts || 0);
  return Math.round(total * 100) / 100;
}

async function generateInvoiceNumber() {
  const count = await Bill.countDocuments();
  const year = new Date().getFullYear();
  return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
}

// GET /api/bills - owners see all, tenants see their own
router.get(
  '/',
  asyncHandler(async (req, res) => {
    let filter = {};
    if (req.user.role === 'TENANT') {
      const tenantIds = (await Tenant.find({ user: req.user.id }).select('_id')).map((t) => t._id);
      filter = { tenant: { $in: tenantIds } };
    } else if (req.query.tenantId) {
      filter = { tenant: req.query.tenantId };
    }
    if (req.query.status) filter.paymentStatus = req.query.status;

    const bills = await Bill.find(filter)
      .populate('tenant')
      .populate('room')
      .populate('payments')
      .populate('meterReading')
      .sort({ billingMonth: -1 });
    res.json({ bills });
  })
);

// POST /api/bills - owner generates a bill for a tenant
router.post(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const {
      tenantId,
      roomId,
      billingMonth,
      rent,
      electricityCharges,
      waterCharges,
      maintenance,
      otherCharges,
      discounts,
      previousDue,
      dueDate,
      meterReadingId,
    } = req.body;

    if (!tenantId || !roomId || !billingMonth || rent == null || !dueDate) {
      return res
        .status(400)
        .json({ error: 'tenantId, roomId, billingMonth, rent and dueDate are required' });
    }

    // If a meter reading is selected, it drives the electricity charge automatically
    // rather than relying on a manually typed number.
    let resolvedElectricityCharges = electricityCharges;
    let meterReading = null;
    if (meterReadingId) {
      meterReading = await MeterReading.findOne({ _id: meterReadingId, room: roomId });
      if (!meterReading) {
        return res.status(404).json({ error: 'Meter reading not found for this room' });
      }
      if (meterReading.billed) {
        return res.status(400).json({ error: 'This meter reading has already been billed' });
      }
      resolvedElectricityCharges = meterReading.amount;
    }

    const totalAmount = computeTotal({
      rent,
      electricityCharges: resolvedElectricityCharges,
      waterCharges,
      maintenance,
      otherCharges,
      discounts,
      previousDue,
    });

    const bill = await Bill.create({
      invoiceNumber: await generateInvoiceNumber(),
      tenant: tenantId,
      room: roomId,
      billingMonth: new Date(billingMonth),
      rent: Number(rent),
      electricityCharges:
        resolvedElectricityCharges != null ? Number(resolvedElectricityCharges) : null,
      waterCharges: waterCharges != null ? Number(waterCharges) : null,
      maintenance: maintenance != null ? Number(maintenance) : null,
      otherCharges: otherCharges != null ? Number(otherCharges) : null,
      discounts: discounts != null ? Number(discounts) : null,
      previousDue: previousDue != null ? Number(previousDue) : null,
      totalAmount,
      dueDate: new Date(dueDate),
      meterReading: meterReading ? meterReading._id : null,
    });

    if (meterReading) {
      meterReading.billed = true;
      await meterReading.save();
    }

    res.status(201).json({ bill });
  })
);

// GET /api/bills/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const bill = await Bill.findById(req.params.id)
      .populate('tenant')
      .populate('room')
      .populate('items')
      .populate('payments')
      .populate('meterReading');
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (req.user.role === 'TENANT') {
      const tenant = await Tenant.findById(bill.tenant?._id || bill.tenant);
      if (!tenant || String(tenant.user) !== String(req.user.id)) {
        return res.status(403).json({ error: 'You do not have permission to view this bill' });
      }
    }
    res.json({ bill });
  })
);

// GET /api/bills/:id/pdf - download a formatted invoice PDF
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const bill = await Bill.findById(req.params.id)
      .populate('tenant')
      .populate({ path: 'room', populate: { path: 'property' } })
      .populate('payments')
      .populate('meterReading');
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (req.user.role === 'TENANT') {
      const tenant = await Tenant.findById(bill.tenant?._id || bill.tenant);
      if (!tenant || String(tenant.user) !== String(req.user.id)) {
        return res.status(403).json({ error: 'You do not have permission to view this bill' });
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${bill.invoiceNumber}.pdf"`);
    buildBillPdf(bill, res);
  })
);

// PUT /api/bills/:id - owner adjusts a bill (before it's paid)
router.put(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await Bill.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bill not found' });

    const {
      electricityCharges,
      waterCharges,
      maintenance,
      otherCharges,
      discounts,
      previousDue,
      dueDate,
    } = req.body;

    const totalAmount = computeTotal({
      rent: existing.rent,
      electricityCharges: electricityCharges ?? existing.electricityCharges,
      waterCharges: waterCharges ?? existing.waterCharges,
      maintenance: maintenance ?? existing.maintenance,
      otherCharges: otherCharges ?? existing.otherCharges,
      discounts: discounts ?? existing.discounts,
      previousDue: previousDue ?? existing.previousDue,
    });

    if (electricityCharges !== undefined) existing.electricityCharges = electricityCharges;
    if (waterCharges !== undefined) existing.waterCharges = waterCharges;
    if (maintenance !== undefined) existing.maintenance = maintenance;
    if (otherCharges !== undefined) existing.otherCharges = otherCharges;
    if (discounts !== undefined) existing.discounts = discounts;
    if (previousDue !== undefined) existing.previousDue = previousDue;
    if (dueDate) existing.dueDate = new Date(dueDate);
    existing.totalAmount = totalAmount;

    await existing.save();
    res.json({ bill: existing });
  })
);

// DELETE /api/bills/:id
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await Bill.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bill not found' });

    if (existing.meterReading) {
      await MeterReading.findByIdAndUpdate(existing.meterReading, { billed: false });
    }
    await Bill.findByIdAndDelete(req.params.id);

    res.json({ message: 'Bill deleted' });
  })
);

module.exports = router;

const express = require('express');
const prisma = require('../lib/prisma');
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
  const count = await prisma.bill.count();
  const year = new Date().getFullYear();
  return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
}

// GET /api/bills - owners see all, tenants see their own
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where =
      req.user.role === 'TENANT'
        ? { tenant: { userId: req.user.id } }
        : req.query.tenantId
        ? { tenantId: req.query.tenantId }
        : {};
    if (req.query.status) where.paymentStatus = req.query.status;

    const bills = await prisma.bill.findMany({
      where,
      include: { tenant: true, room: true, payments: true, meterReading: true },
      orderBy: { billingMonth: 'desc' },
    });
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
      meterReading = await prisma.meterReading.findFirst({
        where: { id: meterReadingId, roomId },
      });
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

    const bill = await prisma.$transaction(async (tx) => {
      const created = await tx.bill.create({
        data: {
          invoiceNumber: await generateInvoiceNumber(),
          tenantId,
          roomId,
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
          meterReadingId: meterReading ? meterReading.id : null,
        },
      });

      if (meterReading) {
        await tx.meterReading.update({
          where: { id: meterReading.id },
          data: { billed: true },
        });
      }

      return created;
    });

    res.status(201).json({ bill });
  })
);

// GET /api/bills/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: { tenant: true, room: true, items: true, payments: true, meterReading: true },
    });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (req.user.role === 'TENANT') {
      const tenant = await prisma.tenant.findUnique({ where: { id: bill.tenantId } });
      if (!tenant || tenant.userId !== req.user.id) {
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
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: { tenant: true, room: { include: { property: true } }, payments: true, meterReading: true },
    });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (req.user.role === 'TENANT') {
      const tenant = await prisma.tenant.findUnique({ where: { id: bill.tenantId } });
      if (!tenant || tenant.userId !== req.user.id) {
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
    const existing = await prisma.bill.findUnique({ where: { id: req.params.id } });
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

    const bill = await prisma.bill.update({
      where: { id: req.params.id },
      data: {
        electricityCharges,
        waterCharges,
        maintenance,
        otherCharges,
        discounts,
        previousDue,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        totalAmount,
      },
    });
    res.json({ bill });
  })
);

// DELETE /api/bills/:id
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.bill.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Bill not found' });

    await prisma.$transaction(async (tx) => {
      if (existing.meterReadingId) {
        await tx.meterReading.update({
          where: { id: existing.meterReadingId },
          data: { billed: false },
        });
      }
      await tx.bill.delete({ where: { id: req.params.id } });
    });

    res.json({ message: 'Bill deleted' });
  })
);

module.exports = router;

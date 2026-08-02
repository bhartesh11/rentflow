const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

async function generateReceiptNumber() {
  const count = await prisma.receipt.count();
  const year = new Date().getFullYear();
  return `RCPT-${year}-${String(count + 1).padStart(5, '0')}`;
}

// GET /api/payments
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where =
      req.user.role === 'TENANT'
        ? { tenant: { userId: req.user.id } }
        : req.query.tenantId
        ? { tenantId: req.query.tenantId }
        : {};

    const payments = await prisma.payment.findMany({
      where,
      include: { tenant: true, bill: true, receipt: true },
      orderBy: { paymentDate: 'desc' },
    });
    res.json({ payments });
  })
);

// POST /api/payments - owner records a payment against a bill
router.post(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { tenantId, billId, amount, paymentMethod, notes } = req.body;
    if (!tenantId || amount == null || !paymentMethod) {
      return res.status(400).json({ error: 'tenantId, amount and paymentMethod are required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let balance = null;
      let bill = null;

      if (billId) {
        bill = await tx.bill.findUnique({ where: { id: billId }, include: { payments: true } });
        if (!bill) throw Object.assign(new Error('Bill not found'), { status: 404 });

        const alreadyPaid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
        const newPaidTotal = alreadyPaid + Number(amount);
        balance = Math.round((bill.totalAmount - newPaidTotal) * 100) / 100;

        const paymentStatus = balance <= 0 ? 'PAID' : newPaidTotal > 0 ? 'PARTIAL' : 'PENDING';
        await tx.bill.update({ where: { id: billId }, data: { paymentStatus } });
      }

      const payment = await tx.payment.create({
        data: {
          tenantId,
          billId: billId || null,
          amount: Number(amount),
          paymentMethod,
          notes,
          balance,
        },
      });

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber: await generateReceiptNumber(),
          paymentId: payment.id,
          amountPaid: Number(amount),
          balanceRemaining: balance != null ? balance : 0,
          paymentDate: payment.paymentDate,
        },
      });

      return { payment, receipt };
    });

    res.status(201).json(result);
  })
);

// GET /api/payments/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { tenant: true, bill: true, receipt: true },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (req.user.role === 'TENANT') {
      const tenant = await prisma.tenant.findUnique({ where: { id: payment.tenantId } });
      if (!tenant || tenant.userId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to view this payment' });
      }
    }
    res.json({ payment });
  })
);

module.exports = router;

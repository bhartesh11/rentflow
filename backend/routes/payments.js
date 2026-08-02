const express = require('express');
const { Payment, Receipt, Bill, Tenant } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

async function generateReceiptNumber() {
  const count = await Receipt.countDocuments();
  const year = new Date().getFullYear();
  return `RCPT-${year}-${String(count + 1).padStart(5, '0')}`;
}

// GET /api/payments
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

    const payments = await Payment.find(filter)
      .populate('tenant')
      .populate('bill')
      .populate('receipt')
      .sort({ paymentDate: -1 });
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

    let balance = null;

    if (billId) {
      const bill = await Bill.findById(billId).populate('payments');
      if (!bill) return res.status(404).json({ error: 'Bill not found' });

      const alreadyPaid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
      const newPaidTotal = alreadyPaid + Number(amount);
      balance = Math.round((bill.totalAmount - newPaidTotal) * 100) / 100;

      const paymentStatus = balance <= 0 ? 'PAID' : newPaidTotal > 0 ? 'PARTIAL' : 'PENDING';
      bill.paymentStatus = paymentStatus;
      await bill.save();
    }

    const payment = await Payment.create({
      tenant: tenantId,
      bill: billId || null,
      amount: Number(amount),
      paymentMethod,
      notes,
      balance,
    });

    const receipt = await Receipt.create({
      receiptNumber: await generateReceiptNumber(),
      payment: payment._id,
      amountPaid: Number(amount),
      balanceRemaining: balance != null ? balance : 0,
      paymentDate: payment.paymentDate,
    });

    res.status(201).json({ payment, receipt });
  })
);

// GET /api/payments/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id)
      .populate('tenant')
      .populate('bill')
      .populate('receipt');
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (req.user.role === 'TENANT') {
      const tenant = await Tenant.findById(payment.tenant?._id || payment.tenant);
      if (!tenant || String(tenant.user) !== String(req.user.id)) {
        return res.status(403).json({ error: 'You do not have permission to view this payment' });
      }
    }
    res.json({ payment });
  })
);

module.exports = router;

const express = require("express");
const { Types } = require("mongoose");

const { PaymentCreate } = require("../validation/schemas");
const { validateBody } = require("../middleware/validate");
const { Payment, Bill, Tenant, nextSequence } = require("../database");
const { requireOwner, getCurrentUser } = require("../auth");
const { serialize, serializeList, toObjectId } = require("../utils/helpers");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { generateReceiptPdf } = require("../utils/pdf");
const { settings } = require("../config");
const { computeStatus } = require("./bills");

const { ObjectId } = Types;
const router = express.Router();

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

router.post(
  "",
  requireOwner,
  validateBody(PaymentCreate),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const bill = await Bill.findById(toObjectId(payload.bill_id)).lean();
    if (!bill) {
      throw new HttpError(404, "Bill not found");
    }

    if (payload.amount <= 0) {
      throw new HttpError(400, "Payment amount must be greater than zero");
    }

    const remaining = bill.total_amount - bill.amount_paid;
    if (payload.amount > remaining + 0.01) {
      throw new HttpError(400, `Payment exceeds outstanding balance of ${remaining.toFixed(2)}`);
    }

    const seq = await nextSequence("payment");
    const paidOn = payload.paid_on || todayIso();

    const payment = await Payment.create({
      receipt_number: `RCPT-${new Date().getUTCFullYear()}-${String(seq).padStart(5, "0")}`,
      bill_id: bill._id,
      tenant_id: bill.tenant_id,
      amount: payload.amount,
      method: payload.method,
      paid_on: paidOn,
      note: payload.note || null,
    });

    const newPaid = bill.amount_paid + payload.amount;
    const newBalance = bill.total_amount - newPaid;
    const newStatus = computeStatus(bill.total_amount, newPaid, bill.due_date);
    await Bill.updateOne(
      { _id: bill._id },
      { $set: { amount_paid: newPaid, balance: newBalance, status: newStatus } }
    );

    res.json(serialize(payment.toObject()));
  })
);

router.get(
  "",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const { bill_id: billId, tenant_id: tenantId } = req.query;
    const query = {};
    if (req.user.role === "tenant") {
      query.tenant_id = new ObjectId(req.user.tenant_id);
    } else if (tenantId) {
      query.tenant_id = toObjectId(tenantId);
    }
    if (billId) {
      query.bill_id = toObjectId(billId);
    }

    const payments = await Payment.find(query).sort({ created_at: -1 }).limit(1000).lean();

    const tenantIds = [...new Set(payments.map((p) => String(p.tenant_id)))].map((id) => new ObjectId(id));
    const tenants = {};
    if (tenantIds.length) {
      const found = await Tenant.find({ _id: { $in: tenantIds } }).lean();
      for (const t of found) {
        tenants[String(t._id)] = t.name;
      }
    }
    for (const p of payments) {
      p.tenant_name = tenants[String(p.tenant_id)];
    }

    res.json(serializeList(payments));
  })
);

router.get(
  "/:paymentId/receipt.pdf",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(toObjectId(req.params.paymentId)).lean();
    if (!payment) {
      throw new HttpError(404, "Payment not found");
    }
    if (req.user.role === "tenant" && String(payment.tenant_id) !== req.user.tenant_id) {
      throw new HttpError(403, "Not authorized");
    }

    const bill = await Bill.findById(payment.bill_id).lean();
    const tenant = await Tenant.findById(payment.tenant_id).lean();
    const pdfBytes = await generateReceiptPdf(payment, bill, tenant, settings.ownerName);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${payment.receipt_number || "receipt"}.pdf"`,
    });
    res.send(pdfBytes);
  })
);

module.exports = router;

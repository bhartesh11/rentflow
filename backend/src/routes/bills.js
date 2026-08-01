const express = require("express");
const { Types } = require("mongoose");

const { BillCreate, BulkBillGenerate, BillUpdate } = require("../validation/schemas");
const { validateBody } = require("../middleware/validate");
const { Bill, Tenant, Room, nextSequence } = require("../database");
const { requireOwner, getCurrentUser } = require("../auth");
const { serialize, serializeList, toObjectId } = require("../utils/helpers");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { generateInvoicePdf } = require("../utils/pdf");
const { settings } = require("../config");

const { ObjectId } = Types;
const router = express.Router();

/** "YYYY-MM-DD" strings sort lexically the same as chronologically, so plain
 * string comparison avoids timezone-conversion bugs from `new Date(...)`. */
function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStatus(total, paid, dueDate) {
  const today = todayIso();
  if (paid >= total && total > 0) return "paid";
  if (paid > 0) {
    const overdue = Boolean(dueDate) && dueDate < today;
    return overdue ? "partial_overdue" : "partial";
  }
  const overdue = Boolean(dueDate) && dueDate < today;
  return overdue ? "overdue" : "unpaid";
}

async function buildBillDoc(tenant, month, rentAmount, lineItems, dueDate, notes = null) {
  const total = rentAmount + lineItems.reduce((sum, i) => sum + i.amount, 0);
  const seq = await nextSequence("bill");
  return {
    bill_number: `INV-${new Date().getUTCFullYear()}-${String(seq).padStart(5, "0")}`,
    tenant_id: tenant._id,
    room_id: tenant.room_id || null,
    month,
    rent_amount: rentAmount,
    line_items: lineItems,
    total_amount: total,
    amount_paid: 0,
    balance: total,
    due_date: dueDate,
    status: computeStatus(total, 0, dueDate),
    notes: notes || null,
  };
}

router.post(
  "",
  requireOwner,
  validateBody(BillCreate),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const tenant = await Tenant.findById(toObjectId(payload.tenant_id)).lean();
    if (!tenant) {
      throw new HttpError(404, "Tenant not found");
    }
    const existing = await Bill.findOne({ tenant_id: tenant._id, month: payload.month }).lean();
    if (existing) {
      throw new HttpError(400, "A bill for this tenant and month already exists");
    }
    const doc = await buildBillDoc(
      tenant,
      payload.month,
      payload.rent_amount,
      payload.line_items,
      payload.due_date,
      payload.notes
    );
    const bill = await Bill.create(doc);
    res.json(serialize(bill.toObject()));
  })
);

router.post(
  "/generate",
  requireOwner,
  validateBody(BulkBillGenerate),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const query = { status: "active" };
    if (payload.tenant_ids) {
      query._id = { $in: payload.tenant_ids.map((t) => toObjectId(t)) };
    }
    const tenants = await Tenant.find(query).limit(1000).lean();

    const created = [];
    const skipped = [];
    for (const tenant of tenants) {
      const existing = await Bill.findOne({ tenant_id: tenant._id, month: payload.month }).lean();
      if (existing) {
        skipped.push(tenant.name);
        continue;
      }
      const room = tenant.room_id ? await Room.findById(tenant.room_id).lean() : null;
      const rentAmount = room ? room.monthly_rent : 0;
      const doc = await buildBillDoc(
        tenant,
        payload.month,
        rentAmount,
        payload.include_utilities,
        payload.due_date
      );
      const bill = await Bill.create(doc);
      created.push(String(bill._id));
    }

    res.json({ created: created.length, skipped, bill_ids: created });
  })
);

router.get(
  "",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const { month, tenant_id: tenantId, status_filter: statusFilter } = req.query;
    const query = {};
    if (req.user.role === "tenant") {
      query.tenant_id = new ObjectId(req.user.tenant_id);
    } else if (tenantId) {
      query.tenant_id = toObjectId(tenantId);
    }
    if (month) {
      query.month = month;
    }

    let bills = await Bill.find(query).sort({ created_at: -1 }).limit(1000).lean();

    const tenantIds = [...new Set(bills.map((b) => String(b.tenant_id)))].map((id) => new ObjectId(id));
    const tenants = {};
    if (tenantIds.length) {
      const found = await Tenant.find({ _id: { $in: tenantIds } }).lean();
      for (const t of found) {
        tenants[String(t._id)] = t.name;
      }
    }
    for (const b of bills) {
      b.tenant_name = tenants[String(b.tenant_id)];
      b.status = computeStatus(b.total_amount, b.amount_paid, b.due_date);
    }

    if (statusFilter) {
      bills = bills.filter((b) => b.status === statusFilter);
    }

    res.json(serializeList(bills));
  })
);

async function getBillWithAccess(billId, user) {
  const bill = await Bill.findById(toObjectId(billId)).lean();
  if (!bill) {
    throw new HttpError(404, "Bill not found");
  }
  if (user.role === "tenant" && String(bill.tenant_id) !== user.tenant_id) {
    throw new HttpError(403, "Not authorized to view this bill");
  }
  bill.status = computeStatus(bill.total_amount, bill.amount_paid, bill.due_date);
  return bill;
}

router.get(
  "/:billId",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const bill = await getBillWithAccess(req.params.billId, req.user);
    res.json(serialize(bill));
  })
);

router.put(
  "/:billId",
  requireOwner,
  validateBody(BillUpdate),
  asyncHandler(async (req, res) => {
    const oid = toObjectId(req.params.billId);
    const bill = await Bill.findById(oid).lean();
    if (!bill) {
      throw new HttpError(404, "Bill not found");
    }

    const payload = req.body;
    const updates = {};
    if (payload.line_items !== null && payload.line_items !== undefined) {
      const items = payload.line_items;
      const total = bill.rent_amount + items.reduce((sum, i) => sum + i.amount, 0);
      updates.line_items = items;
      updates.total_amount = total;
      updates.balance = total - bill.amount_paid;
      updates.status = computeStatus(total, bill.amount_paid, payload.due_date || bill.due_date);
    }
    if (payload.due_date !== null && payload.due_date !== undefined) {
      updates.due_date = payload.due_date;
    }
    if (payload.notes !== null && payload.notes !== undefined) {
      updates.notes = payload.notes;
    }

    if (Object.keys(updates).length > 0) {
      await Bill.updateOne({ _id: oid }, { $set: updates });
    }
    const updated = await Bill.findById(oid).lean();
    res.json(serialize(updated));
  })
);

router.delete(
  "/:billId",
  requireOwner,
  asyncHandler(async (req, res) => {
    const oid = toObjectId(req.params.billId);
    const result = await Bill.deleteOne({ _id: oid });
    if (result.deletedCount === 0) {
      throw new HttpError(404, "Bill not found");
    }
    res.json({ deleted: true });
  })
);

router.get(
  "/:billId/invoice.pdf",
  getCurrentUser,
  asyncHandler(async (req, res) => {
    const bill = await getBillWithAccess(req.params.billId, req.user);
    const tenant = await Tenant.findById(bill.tenant_id).lean();
    const room = bill.room_id ? await Room.findById(bill.room_id).lean() : null;
    const pdfBytes = await generateInvoicePdf(bill, tenant, room, settings.ownerName);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bill.bill_number || "invoice"}.pdf"`,
    });
    res.send(pdfBytes);
  })
);

module.exports = { router, computeStatus };

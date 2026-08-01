const express = require("express");
const { ObjectId } = require("mongodb");

const { BillCreate, BulkBillGenerate, BillUpdate } = require("../validation/schemas");
const { validateBody } = require("../middleware/validate");
const { billsCol, tenantsCol, roomsCol, nextSequence } = require("../database");
const { requireOwner, getCurrentUser } = require("../auth");
const { serialize, serializeList, toObjectId } = require("../utils/helpers");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { generateInvoicePdf } = require("../utils/pdf");
const { settings } = require("../config");

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
    created_at: new Date(),
  };
}

router.post(
  "",
  requireOwner,
  validateBody(BillCreate),
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const tenant = await tenantsCol.findOne({ _id: toObjectId(payload.tenant_id) });
    if (!tenant) {
      throw new HttpError(404, "Tenant not found");
    }
    const existing = await billsCol.findOne({ tenant_id: tenant._id, month: payload.month });
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
    const result = await billsCol.insertOne(doc);
    const bill = await billsCol.findOne({ _id: result.insertedId });
    res.json(serialize(bill));
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
    const tenants = await tenantsCol.find(query).limit(1000).toArray();

    const created = [];
    const skipped = [];
    for (const tenant of tenants) {
      const existing = await billsCol.findOne({ tenant_id: tenant._id, month: payload.month });
      if (existing) {
        skipped.push(tenant.name);
        continue;
      }
      const room = tenant.room_id ? await roomsCol.findOne({ _id: tenant.room_id }) : null;
      const rentAmount = room ? room.monthly_rent : 0;
      const doc = await buildBillDoc(
        tenant,
        payload.month,
        rentAmount,
        payload.include_utilities,
        payload.due_date
      );
      const result = await billsCol.insertOne(doc);
      created.push(String(result.insertedId));
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

    let bills = await billsCol.find(query).sort({ created_at: -1 }).limit(1000).toArray();

    const tenantIds = [...new Set(bills.map((b) => String(b.tenant_id)))].map((id) => new ObjectId(id));
    const tenants = {};
    if (tenantIds.length) {
      const cursor = tenantsCol.find({ _id: { $in: tenantIds } });
      for await (const t of cursor) {
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
  const bill = await billsCol.findOne({ _id: toObjectId(billId) });
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
    const bill = await billsCol.findOne({ _id: oid });
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
      await billsCol.updateOne({ _id: oid }, { $set: updates });
    }
    const updated = await billsCol.findOne({ _id: oid });
    res.json(serialize(updated));
  })
);

router.delete(
  "/:billId",
  requireOwner,
  asyncHandler(async (req, res) => {
    const oid = toObjectId(req.params.billId);
    const result = await billsCol.deleteOne({ _id: oid });
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
    const tenant = await tenantsCol.findOne({ _id: bill.tenant_id });
    const room = bill.room_id ? await roomsCol.findOne({ _id: bill.room_id }) : null;
    const pdfBytes = await generateInvoicePdf(bill, tenant, room, settings.ownerName);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bill.bill_number || "invoice"}.pdf"`,
    });
    res.send(pdfBytes);
  })
);

module.exports = { router, computeStatus };

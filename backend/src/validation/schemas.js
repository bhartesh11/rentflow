const { z } = require("zod");

const email = z.string().email();

// ---------- Auth ----------
const LoginRequest = z.object({
  email,
  password: z.string(),
});

const TenantRegisterRequest = z.object({
  name: z.string(),
  email,
  password: z.string().min(6),
  phone: z.string(),
  invite_code: z.string(), // room id or owner-provided code to prevent open signup abuse
});

// ---------- Rooms ----------
const RoomCreate = z.object({
  name: z.string(),
  floor: z.string().nullable().optional(),
  monthly_rent: z.number(),
  capacity: z.number().int().default(1),
  notes: z.string().nullable().optional(),
});

const RoomUpdate = z.object({
  name: z.string().nullable().optional(),
  floor: z.string().nullable().optional(),
  monthly_rent: z.number().nullable().optional(),
  capacity: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ---------- Tenants ----------
const TenantCreate = z.object({
  name: z.string(),
  email,
  phone: z.string(),
  room_id: z.string().nullable().optional(),
  move_in_date: z.string().nullable().optional(),
  id_proof_type: z.string().nullable().optional(),
  id_proof_number: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  security_deposit: z.number().nullable().optional().default(0),
  set_password: z.string().nullable().optional(), // if owner wants to set login credentials directly
});

const TenantUpdate = z.object({
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  room_id: z.string().nullable().optional(),
  status: z.enum(["active", "vacated"]).nullable().optional(),
  move_out_date: z.string().nullable().optional(),
  id_proof_type: z.string().nullable().optional(),
  id_proof_number: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  security_deposit: z.number().nullable().optional(),
});

// ---------- Bills ----------
const LineItem = z.object({
  label: z.string(),
  amount: z.number(),
});

const BillCreate = z.object({
  tenant_id: z.string(),
  month: z.string(), // "YYYY-MM"
  rent_amount: z.number(),
  line_items: z.array(LineItem).default([]),
  due_date: z.string(), // "YYYY-MM-DD"
  notes: z.string().nullable().optional(),
});

const BulkBillGenerate = z.object({
  month: z.string(), // "YYYY-MM"
  due_date: z.string(), // "YYYY-MM-DD"
  include_utilities: z.array(LineItem).default([]), // applied to every active tenant's bill, optional
  tenant_ids: z.array(z.string()).nullable().optional(), // if omitted, applies to all active tenants
});

const BillUpdate = z.object({
  line_items: z.array(LineItem).nullable().optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ---------- Payments ----------
const PaymentCreate = z.object({
  bill_id: z.string(),
  amount: z.number(),
  method: z
    .enum(["cash", "bank_transfer", "upi", "cheque", "other"])
    .default("cash"),
  paid_on: z.string().nullable().optional(), // "YYYY-MM-DD", defaults to today
  note: z.string().nullable().optional(),
});

// ---------- Maintenance Requests ----------
const RequestCreate = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string().nullable().optional().default("general"),
});

const RequestUpdate = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
  owner_note: z.string().nullable().optional(),
});

module.exports = {
  LoginRequest,
  TenantRegisterRequest,
  RoomCreate,
  RoomUpdate,
  TenantCreate,
  TenantUpdate,
  LineItem,
  BillCreate,
  BulkBillGenerate,
  BillUpdate,
  PaymentCreate,
  RequestCreate,
  RequestUpdate,
};

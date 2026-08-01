const mongoose = require("mongoose");
const { settings } = require("./config");

const { Schema } = mongoose;

// ---------- Schemas (collection names match the original Motor/PyMongo ones) ----------

const userSchema = new Schema(
  {
    name: String,
    email: { type: String, required: true },
    password_hash: String,
    role: { type: String, enum: ["owner", "tenant"], required: true },
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    created_at: { type: Date, default: Date.now },
  },
  { collection: "users", versionKey: false }
);
userSchema.index({ email: 1 }, { unique: true });

const roomSchema = new Schema(
  {
    name: String,
    floor: { type: String, default: null },
    monthly_rent: Number,
    capacity: { type: Number, default: 1 },
    notes: { type: String, default: null },
    status: { type: String, default: "vacant" },
    created_at: { type: Date, default: Date.now },
  },
  { collection: "rooms", versionKey: false }
);
roomSchema.index({ name: 1 });

const tenantSchema = new Schema(
  {
    name: String,
    email: String,
    phone: String,
    room_id: { type: Schema.Types.ObjectId, ref: "Room", default: null },
    move_in_date: { type: String, default: null },
    move_out_date: { type: String, default: null },
    id_proof_type: { type: String, default: null },
    id_proof_number: { type: String, default: null },
    address: { type: String, default: null },
    security_deposit: { type: Number, default: 0 },
    status: { type: String, default: "active" },
    created_at: { type: Date, default: Date.now },
  },
  { collection: "tenants", versionKey: false }
);
tenantSchema.index({ email: 1 }, { unique: true, sparse: true });

const lineItemSchema = new Schema({ label: String, amount: Number }, { _id: false });

const billSchema = new Schema(
  {
    bill_number: String,
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant" },
    room_id: { type: Schema.Types.ObjectId, ref: "Room", default: null },
    month: String,
    rent_amount: Number,
    line_items: { type: [lineItemSchema], default: [] },
    total_amount: Number,
    amount_paid: { type: Number, default: 0 },
    balance: Number,
    due_date: String,
    status: String,
    notes: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { collection: "bills", versionKey: false }
);
billSchema.index({ tenant_id: 1 });

const paymentSchema = new Schema(
  {
    receipt_number: String,
    bill_id: { type: Schema.Types.ObjectId, ref: "Bill" },
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant" },
    amount: Number,
    method: { type: String, default: "cash" },
    paid_on: String,
    note: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  },
  { collection: "payments", versionKey: false }
);
paymentSchema.index({ bill_id: 1 });

const requestSchema = new Schema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant" },
    room_id: { type: Schema.Types.ObjectId, ref: "Room", default: null },
    title: String,
    description: String,
    category: { type: String, default: "general" },
    status: { type: String, default: "open" },
    owner_note: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    resolved_at: { type: Date, default: null },
  },
  { collection: "maintenance_requests", versionKey: false }
);

const counterSchema = new Schema(
  { _id: { type: String }, seq: { type: Number, default: 0 } },
  { collection: "counters", versionKey: false, _id: false }
);

const User = mongoose.model("User", userSchema);
const Room = mongoose.model("Room", roomSchema);
const Tenant = mongoose.model("Tenant", tenantSchema);
const Bill = mongoose.model("Bill", billSchema);
const Payment = mongoose.model("Payment", paymentSchema);
const MaintenanceRequest = mongoose.model("MaintenanceRequest", requestSchema);
const Counter = mongoose.model("Counter", counterSchema);

/** Simple auto-increment counter used for human-friendly invoice/receipt numbers. */
async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();
  return doc.seq;
}

async function connect() {
  await mongoose.connect(settings.mongoUri, { dbName: settings.mongoDbName });
  console.log("Database connection successful");
  
}

async function ensureIndexes() {
  await Promise.all([
    User.createIndexes(),
    Room.createIndexes(),
    Tenant.createIndexes(),
    Bill.createIndexes(),
    Payment.createIndexes(),
  ]);
}

module.exports = {
  mongoose,
  User,
  Room,
  Tenant,
  Bill,
  Payment,
  MaintenanceRequest,
  Counter,
  nextSequence,
  connect,
  ensureIndexes,
};

const { MongoClient } = require("mongodb");
const { settings } = require("./config");

const client = new MongoClient(settings.mongoUri);
const db = client.db(settings.mongoDbName);

// Collections
const usersCol = db.collection("users"); // owner + tenant login accounts
const roomsCol = db.collection("rooms");
const tenantsCol = db.collection("tenants");
const billsCol = db.collection("bills");
const paymentsCol = db.collection("payments");
const requestsCol = db.collection("maintenance_requests");
const countersCol = db.collection("counters");

/** Simple auto-increment counter used for human-friendly invoice/receipt numbers. */
async function nextSequence(name) {
  const result = await countersCol.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  // Depending on driver version, the updated doc may be the direct return
  // value or nested under `.value`. Handle both for safety.
  const doc = result && result.value !== undefined ? result.value : result;
  return doc.seq;
}

async function connect() {
  await client.connect();
}

async function ensureIndexes() {
  await usersCol.createIndex("email", { unique: true });
  await roomsCol.createIndex("name");
  await tenantsCol.createIndex("email", { unique: true, sparse: true });
  await billsCol.createIndex("tenant_id");
  await paymentsCol.createIndex("bill_id");
}

module.exports = {
  client,
  db,
  usersCol,
  roomsCol,
  tenantsCol,
  billsCol,
  paymentsCol,
  requestsCol,
  countersCol,
  nextSequence,
  connect,
  ensureIndexes,
};

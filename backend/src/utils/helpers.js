const { ObjectId } = require("mongodb");

/** Convert a Mongo document into a JSON-safe object (string ids, no internal fields). */
function serialize(doc) {
  if (doc === null || doc === undefined) return null;
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k === "_id") {
      out.id = String(v);
    } else if (v instanceof ObjectId) {
      out[k] = String(v);
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (k === "password_hash") {
      continue;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function serializeList(docs) {
  return docs.map(serialize);
}

/** Throws if the id string isn't a valid ObjectId (mirrors Python's ValueError). */
function toObjectId(idStr) {
  if (!ObjectId.isValid(idStr)) {
    throw new Error("Invalid id format");
  }
  return new ObjectId(idStr);
}

module.exports = { serialize, serializeList, toObjectId };

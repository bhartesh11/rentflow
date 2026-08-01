const { HttpError } = require("../utils/httpError");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ detail: err.detail });
  }
  // "Invalid id format" errors thrown by toObjectId() (mirrors the
  // Python routes that catch ValueError and return 400).
  if (err instanceof Error && err.message === "Invalid id format") {
    return res.status(400).json({ detail: "Invalid id format" });
  }
  console.error(err);
  return res.status(500).json({ detail: "Internal server error" });
}

module.exports = { errorHandler };

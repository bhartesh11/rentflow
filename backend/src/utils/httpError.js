/** Mirrors FastAPI's HTTPException(status_code, detail). */
class HttpError extends Error {
  constructor(statusCode, detail) {
    super(detail);
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

module.exports = { HttpError };

/**
 * Validates req.body against a zod schema, attaches the parsed/defaulted
 * result to req.body, and responds 422 (mirrors FastAPI's validation error
 * status code) with the issue list on failure.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        detail: result.error.issues.map((issue) => ({
          loc: issue.path,
          msg: issue.message,
          type: issue.code,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };

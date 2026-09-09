/**
 * Request body validation middleware using Zod schemas.
 * Returns 400 with flattened field errors on validation failure.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data; // use parsed/coerced values
    next();
  };
}

module.exports = validate;

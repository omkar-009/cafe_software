/**
 * Request validation middleware factory using Zod schemas.
 *
 * Usage:
 *   router.post('/', validate({ body: createMenuSchema }), controller.create)
 *
 * Validated + coerced values REPLACE req.body / req.query / req.params so
 * downstream handlers receive typed, sanitized data.
 */
export default function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) req.query = schemas.query.parse(req.query ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      next();
    } catch (err) {
      next(err); // ZodError → handled centrally as 422
    }
  };
}

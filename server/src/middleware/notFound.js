import ApiError from '../shared/ApiError.js';

/** Terminal 404 handler for unmatched routes. */
export default function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

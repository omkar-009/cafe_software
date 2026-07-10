/**
 * Centralized error handler. Converts any thrown value into the standard error
 * envelope: { success:false, error:{ code, message, details } }.
 *
 * - ApiError            → rendered as-is
 * - ZodError            → 422 with field details
 * - pg unique violation → 409 conflict
 * - everything else     → 500 (message hidden in production)
 */
import { ZodError } from 'zod';
import ApiError from '../shared/ApiError.js';
import logger from '../config/logger.js';
import { isProd } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
  let error = err;

  if (err instanceof ZodError) {
    error = ApiError.unprocessable('Validation failed', {
      fields: err.flatten().fieldErrors,
    });
  } else if (err?.code === '23505') {
    // Postgres unique_violation
    error = ApiError.conflict('A record with these details already exists', {
      constraint: err.constraint,
    });
  } else if (err?.code === '23503') {
    // foreign_key_violation
    error = ApiError.badRequest('Referenced record does not exist', {
      constraint: err.constraint,
    });
  } else if (!(err instanceof ApiError)) {
    error = ApiError.internal(err?.message);
    error.isOperational = false;
  }

  const payload = {
    success: false,
    error: {
      code: error.code,
      message: isProd && !error.isOperational ? 'Something went wrong' : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };

  const logCtx = {
    err,
    reqId: req.id,
    method: req.method,
    url: req.originalUrl,
    tenantId: req.tenant?.id,
    userId: req.user?.id,
  };
  if (error.statusCode >= 500) logger.error(logCtx, 'Unhandled request error');
  else logger.warn(logCtx, 'Request error');

  res.status(error.statusCode).json(payload);
}

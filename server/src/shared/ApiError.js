/**
 * Operational (expected) application error carrying an HTTP status + code.
 * The centralized error handler renders these directly; anything that is not
 * an ApiError is treated as an unexpected 500.
 */
export default class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message      human-readable message
   * @param {object} [options]
   * @param {string} [options.code]     machine-readable error code
   * @param {object} [options.details]  field-level or extra context
   */
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code || defaultCode(statusCode);
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', details });
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }
  static conflict(message = 'Resource already exists', details) {
    return new ApiError(409, message, { code: 'CONFLICT', details });
  }
  static unprocessable(message = 'Validation failed', details) {
    return new ApiError(422, message, { code: 'VALIDATION_ERROR', details });
  }
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message, { code: 'RATE_LIMITED' });
  }
  static internal(message = 'Something went wrong') {
    return new ApiError(500, message, { code: 'INTERNAL_ERROR' });
  }
}

function defaultCode(statusCode) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
  };
  return map[statusCode] || 'ERROR';
}

/**
 * Wraps an async Express handler so rejected promises are forwarded to the
 * centralized error handler instead of crashing the process.
 *
 * @param {(req, res, next) => Promise<any>} fn
 */
export default function catchAsync(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

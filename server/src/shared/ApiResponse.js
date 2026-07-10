/**
 * Standard success response envelope. Keeps every endpoint consistent:
 *   { success: true, message, data, meta }
 */
export function ok(res, data = null, { message = 'OK', meta, status = 200 } = {}) {
  return res.status(status).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function created(res, data = null, { message = 'Created', meta } = {}) {
  return ok(res, data, { message, meta, status: 201 });
}

export function noContent(res) {
  return res.status(204).send();
}

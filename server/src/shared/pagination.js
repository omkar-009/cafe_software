/**
 * Pagination helpers supporting BOTH:
 *   - cursor-based pagination (preferred for large, append-heavy lists)
 *   - offset/limit pagination (simple admin tables)
 *
 * Cursors are opaque base64 of `{ createdAt, id }` so clients never construct
 * them by hand.
 */

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 20;

export function parseLimit(rawLimit, fallback = DEFAULT_LIMIT) {
  const n = Number.parseInt(rawLimit, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.min(n, MAX_LIMIT);
}

export function parseOffsetPagination(query) {
  const limit = parseLimit(query.limit);
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const offset = (page - 1) * limit;
  return { limit, page, offset };
}

export function buildOffsetMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function buildCursorMeta({ items, limit, cursorFields = ['created_at', 'id'] }) {
  const hasNext = items.length > limit;
  const page = hasNext ? items.slice(0, limit) : items;
  const last = page[page.length - 1];
  const nextCursor =
    hasNext && last
      ? encodeCursor(cursorFields.reduce((acc, f) => ({ ...acc, [f]: last[f] }), {}))
      : null;
  return { items: page, meta: { pagination: { limit, hasNext, nextCursor } } };
}

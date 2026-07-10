/**
 * Build a safe, parameterized dynamic UPDATE statement from a whitelist.
 *
 * Only keys present in `allowed` AND provided (non-undefined) in `data` are
 * included, preventing mass-assignment. Returns the SET fragment plus the
 * ordered params, starting placeholders at `startIndex`.
 *
 * @example
 *   const { setSql, params, nextIndex } = buildUpdate(
 *     { name: 'X', bogus: 1 }, ['name', 'price'], 1);
 *   // setSql => 'name = $1', params => ['X'], nextIndex => 2
 */
export function buildUpdate(data, allowed, startIndex = 1) {
  const cols = [];
  const params = [];
  let i = startIndex;
  for (const key of allowed) {
    if (data[key] !== undefined) {
      cols.push(`${key} = $${i}`);
      params.push(data[key]);
      i += 1;
    }
  }
  return { setSql: cols.join(', '), params, nextIndex: i, hasChanges: cols.length > 0 };
}

/** camelCase → snake_case for mapping DTO keys to columns. */
export function snake(str) {
  return str.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

/** Shallowly remap every key of an object from camelCase to snake_case. */
export function mapKeysToSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [snake(k), v]));
}

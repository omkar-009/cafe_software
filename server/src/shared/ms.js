/**
 * Convert a short duration string (e.g. "15m", "7d", "500ms") to milliseconds.
 * Small dependency-free helper used for cookie maxAge.
 */
const UNITS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

export default function ms(value) {
  if (typeof value === 'number') return value;
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/.exec(String(value).trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  return Math.round(parseFloat(match[1]) * UNITS[match[2]]);
}

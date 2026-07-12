import dayjs from 'dayjs';

/** Date-range presets shared by orders, KDS, waiter, and analytics filters. */
export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '1m', label: 'Last 1 month' },
  { key: '3m', label: 'Last 3 months' },
  { key: '6m', label: 'Last 6 months' },
  { key: 'custom', label: 'Custom range' },
];

/**
 * Resolve a preset (+ optional custom {from,to} date strings) into ISO
 * `{ from, to }` bounds for the API.
 */
export function rangeFor(preset, custom = {}) {
  const now = dayjs();
  const day = (d) => d.startOf('day');
  let from;
  let to = now.endOf('day');
  switch (preset) {
    case 'today': from = day(now); break;
    case 'yesterday': from = day(now.subtract(1, 'day')); to = now.subtract(1, 'day').endOf('day'); break;
    case '7d': from = day(now.subtract(7, 'day')); break;
    case '1m': from = day(now.subtract(1, 'month')); break;
    case '3m': from = day(now.subtract(3, 'month')); break;
    case '6m': from = day(now.subtract(6, 'month')); break;
    case 'custom':
      from = custom.from ? day(dayjs(custom.from)) : day(now);
      to = custom.to ? dayjs(custom.to).endOf('day') : now.endOf('day');
      break;
    default: from = day(now);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

import dayjs from 'dayjs';

/** 12-hour clock helpers used across every panel for consistent time display. */

/** e.g. "2:05 PM" */
export const fmtTime = (t) => (t ? dayjs(t).format('h:mm A') : '—');

/** e.g. "13 Jul, 2:05 PM" */
export const fmtDateTime = (t) => (t ? dayjs(t).format('DD MMM, h:mm A') : '—');

/** e.g. "13 Jul 2026" */
export const fmtDate = (t) => (t ? dayjs(t).format('DD MMM YYYY') : '—');

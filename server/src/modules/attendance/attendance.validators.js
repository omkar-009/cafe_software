import { z } from 'zod';
import { ATTENDANCE_STATUS } from '../../shared/constants.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const monthStr = z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM');

export const markSchema = z.object({
  userId: z.string().uuid(),
  workDate: dateStr,
  status: z.nativeEnum(ATTENDANCE_STATUS),
  note: z.string().max(500).optional(),
  checkIn: z.string().datetime({ offset: true }).optional(),
  checkOut: z.string().datetime({ offset: true }).optional(),
});

export const bulkMarkSchema = z.object({
  userId: z.string().uuid(),
  dates: z.array(dateStr).min(1).max(62),
  status: z.nativeEnum(ATTENDANCE_STATUS),
});

export const registerQuerySchema = z.object({ date: dateStr.optional() });
export const summaryQuerySchema = z.object({ month: monthStr.optional() });
export const staffMonthSchema = z.object({ month: monthStr.optional() });
export const userIdParamSchema = z.object({ userId: z.string().uuid() });
export const postSalariesSchema = z.object({ month: monthStr.optional() });

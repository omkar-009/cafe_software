import { z } from 'zod';
import { EXPENSE_CATEGORY, EXPENSE_PAYMENT_METHOD } from '../../shared/constants.js';

export const createExpenseSchema = z.object({
  category: z.nativeEnum(EXPENSE_CATEGORY),
  title: z.string().min(1).max(160),
  amount: z.number().nonnegative(),
  vendor: z.string().max(160).optional(),
  paymentMethod: z.nativeEnum(EXPENSE_PAYMENT_METHOD).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  note: z.string().max(1000).optional(),
  attachmentUrl: z.string().url().max(500).optional(),
  isRecurring: z.boolean().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const listExpensesSchema = z.object({
  category: z.nativeEnum(EXPENSE_CATEGORY).optional(),
  search: z.string().max(120).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
});

/** Reports accept an ISO datetime range (from analytics DateFilter). */
export const rangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

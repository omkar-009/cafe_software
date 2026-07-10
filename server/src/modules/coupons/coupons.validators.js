import { z } from 'zod';
import { COUPON_TYPE } from '../../shared/constants.js';

export const createCouponSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Alphanumeric code only'),
  description: z.string().max(300).optional(),
  type: z.nativeEnum(COUPON_TYPE),
  value: z.number().min(0),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  usageLimit: z.number().int().min(1).optional(),
  perCustomerLimit: z.number().int().min(1).optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const updateCouponSchema = createCouponSchema.partial().omit({ code: true });

export const listCouponsSchema = z.object({ activeOnly: z.coerce.boolean().optional() });
export const idParamSchema = z.object({ id: z.string().uuid() });

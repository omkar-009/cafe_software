import { z } from 'zod';
import { ORDER_STATUS, PAYMENT_STATUS } from '../../shared/constants.js';

export const cartItemSchema = z.object({
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(99),
  addonOptionIds: z.array(z.string().uuid()).max(20).optional(),
  note: z.string().max(300).optional(),
});

export const createOrderSchema = z.object({
  tableId: z.string().uuid().optional(),
  floorId: z.string().uuid().optional(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).optional(),
  cart: z.array(cartItemSchema).min(1, 'Add at least one item'),
  couponCode: z.string().max(30).optional(),
  customer: z.object({
    name: z.string().max(120).optional(),
    phone: z.string().max(20).optional(),
  }).optional(),
  customerNote: z.string().max(500).optional(),
  waiterId: z.string().uuid().optional(),
});

export const listOrdersSchema = z.object({
  status: z.nativeEnum(ORDER_STATUS).optional(),
  paymentStatus: z.nativeEnum(PAYMENT_STATUS).optional(),
  tableId: z.string().uuid().optional(),
  waiterId: z.string().uuid().optional(),
  search: z.string().max(40).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const changeStatusSchema = z.object({ status: z.nativeEnum(ORDER_STATUS) });
export const cancelOrderSchema = z.object({ reason: z.string().max(300).optional() });
export const idParamSchema = z.object({ id: z.string().uuid() });

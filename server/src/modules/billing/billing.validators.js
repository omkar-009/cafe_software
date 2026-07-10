import { z } from 'zod';
import { PAYMENT_METHOD } from '../../shared/constants.js';

export const paySchema = z.object({
  method: z.nativeEnum(PAYMENT_METHOD),
  amount: z.number().min(0).optional(),
  reference: z.string().max(120).optional(),
});

export const orderIdParamSchema = z.object({ orderId: z.string().uuid() });

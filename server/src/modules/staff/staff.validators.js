import { z } from 'zod';
import { ROLES } from '../../shared/constants.js';

const assignableRole = z.enum([ROLES.RESTAURANT_ADMIN, ROLES.KITCHEN, ROLES.WAITER]);

export const createStaffSchema = z.object({
  role: assignableRole,
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(72),
  permissions: z.array(z.string()).optional(),
});

export const updateStaffSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(20).optional(),
  role: assignableRole.optional(),
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
});

export const resetPasswordSchema = z.object({ password: z.string().min(8).max(72) });

export const listStaffSchema = z.object({
  role: assignableRole.optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

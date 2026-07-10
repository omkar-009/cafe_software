import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password too long');

const slug = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

export const registerSchema = z.object({
  restaurantName: z.string().min(2).max(120),
  slug,
  adminName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(6).max(20).optional(),
  password,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: slug.optional(),
});

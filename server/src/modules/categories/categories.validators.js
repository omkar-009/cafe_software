import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const listCategoriesSchema = z.object({
  includeInactive: z.coerce.boolean().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

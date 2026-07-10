import { z } from 'zod';
import { FOOD_TYPE } from '../../shared/constants.js';

const variantSchema = z.object({
  name: z.string().min(1).max(60),
  priceDelta: z.number().default(0),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const addonOptionSchema = z.object({
  name: z.string().min(1).max(60),
  price: z.number().min(0).default(0),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const addonGroupSchema = z.object({
  name: z.string().min(1).max(60),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  options: z.array(addonOptionSchema).default([]),
});

const imageSchema = z.object({
  url: z.string().url(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const createItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  price: z.number().min(0),
  taxRate: z.number().min(0).max(100).optional(),
  foodType: z.nativeEnum(FOOD_TYPE).optional(),
  spicyLevel: z.number().int().min(0).max(3).optional(),
  prepTimeMins: z.number().int().min(0).max(240).optional(),
  ingredients: z.array(z.string()).optional(),
  calories: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  variants: z.array(variantSchema).optional(),
  images: z.array(imageSchema).optional(),
  addonGroups: z.array(addonGroupSchema).optional(),
});

export const updateItemSchema = createItemSchema.partial().extend({
  isOutOfStock: z.boolean().optional(),
});

export const toggleItemSchema = z.object({
  isAvailable: z.boolean().optional(),
  isOutOfStock: z.boolean().optional(),
}).refine((d) => d.isAvailable !== undefined || d.isOutOfStock !== undefined, {
  message: 'Provide isAvailable or isOutOfStock',
});

export const listItemsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  foodType: z.nativeEnum(FOOD_TYPE).optional(),
  search: z.string().max(120).optional(),
  availableOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

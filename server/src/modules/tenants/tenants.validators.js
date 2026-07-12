import { z } from 'zod';
import { TENANT_STATUS } from '../../shared/constants.js';

// Accepts an absolute URL, a same-origin relative path (uploaded images), or ''.
const imageField = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^(https?:\/\/|\/)/.test(v), 'Must be a URL or an uploaded image path')
  .optional();

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  legalName: z.string().max(160).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  logoUrl: imageField,
  coverUrl: imageField,
  brandColor: z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Use a hex color like #F97316').optional(),
  menuHeader: z.string().max(2000).optional(),
  menuFooter: z.string().max(2000).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(64).optional(),
  gstNumber: z.string().max(30).optional(),
  address: z
    .object({
      line1: z.string().max(200).optional(),
      city: z.string().max(80).optional(),
      state: z.string().max(80).optional(),
      country: z.string().max(80).optional(),
      pincode: z.string().max(12).optional(),
    })
    .optional(),
  settings: z
    .object({
      defaultTaxRate: z.number().min(0).max(100).optional(),
      serviceChargeRate: z.number().min(0).max(100).optional(),
      enableServiceCharge: z.boolean().optional(),
      currencySymbol: z.string().max(4).optional(),
      // Order flow: when true, new orders skip the manual "accept" step and go
      // straight to PREPARING.
      autoStartPreparing: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
});

export const listTenantsSchema = z.object({
  status: z.nativeEnum(TENANT_STATUS).optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const setStatusSchema = z.object({
  status: z.nativeEnum(TENANT_STATUS),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

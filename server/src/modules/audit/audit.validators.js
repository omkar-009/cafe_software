import { z } from 'zod';

export const listAuditSchema = z.object({
  module: z.string().max(40).optional(),
  action: z.string().max(60).optional(),
  actorId: z.string().uuid().optional(),
  actorRole: z.string().max(40).optional(),
  search: z.string().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const exportAuditSchema = listAuditSchema.extend({
  format: z.enum(['csv', 'xlsx']).optional(),
});

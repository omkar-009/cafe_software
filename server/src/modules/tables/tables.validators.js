import { z } from 'zod';
import { TABLE_STATUS } from '../../shared/constants.js';

export const createFloorSchema = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.number().int().min(0).optional(),
});
export const updateFloorSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const createTableSchema = z.object({
  floorId: z.string().uuid().optional(),
  tableNumber: z.string().min(1).max(20),
  label: z.string().max(60).optional(),
  seatCapacity: z.number().int().min(1).max(50).optional(),
});
export const updateTableSchema = z.object({
  floorId: z.string().uuid().nullable().optional(),
  tableNumber: z.string().min(1).max(20).optional(),
  label: z.string().max(60).optional(),
  seatCapacity: z.number().int().min(1).max(50).optional(),
  status: z.nativeEnum(TABLE_STATUS).optional(),
});

export const listTablesSchema = z.object({
  floorId: z.string().uuid().optional(),
  status: z.nativeEnum(TABLE_STATUS).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

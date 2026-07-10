import catchAsync from '../../shared/catchAsync.js';
import { ok, created, noContent } from '../../shared/ApiResponse.js';
import * as service from './tables.service.js';

/* Floors */
export const listFloors = catchAsync(async (req, res) => {
  const floors = await service.listFloors(req.tenantId);
  return ok(res, { floors });
});
export const createFloor = catchAsync(async (req, res) => {
  const floor = await service.createFloor(req);
  return created(res, { floor }, { message: 'Floor created' });
});
export const updateFloor = catchAsync(async (req, res) => {
  const floor = await service.updateFloor(req);
  return ok(res, { floor }, { message: 'Floor updated' });
});
export const deleteFloor = catchAsync(async (req, res) => {
  await service.deleteFloor(req);
  return noContent(res);
});

/* Tables */
export const listTables = catchAsync(async (req, res) => {
  const tables = await service.listTables({
    tenantId: req.tenantId,
    floorId: req.query.floorId,
    status: req.query.status,
  });
  return ok(res, { tables });
});
export const getTable = catchAsync(async (req, res) => {
  const table = await service.getTable({ tenantId: req.tenantId, id: req.params.id });
  return ok(res, { table });
});
export const createTable = catchAsync(async (req, res) => {
  const table = await service.createTable(req);
  return created(res, { table }, { message: 'Table created' });
});
export const updateTable = catchAsync(async (req, res) => {
  const table = await service.updateTable(req);
  return ok(res, { table }, { message: 'Table updated' });
});
export const deleteTable = catchAsync(async (req, res) => {
  await service.deleteTable(req);
  return noContent(res);
});

/* QR */
export const getQr = catchAsync(async (req, res) => {
  const result = await service.getTableQr({ tenantId: req.tenantId, id: req.params.id });
  return ok(res, result);
});
export const regenerateQr = catchAsync(async (req, res) => {
  const result = await service.regenerateQr(req);
  return ok(res, result, { message: 'QR code regenerated' });
});

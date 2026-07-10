import catchAsync from '../../shared/catchAsync.js';
import { ok, created, noContent } from '../../shared/ApiResponse.js';
import { parseOffsetPagination, buildOffsetMeta } from '../../shared/pagination.js';
import * as service from './staff.service.js';

export const list = catchAsync(async (req, res) => {
  const { limit, offset, page } = parseOffsetPagination(req.query);
  const { rows, total } = await service.listStaff({
    tenantId: req.tenantId,
    role: req.query.role,
    search: req.query.search,
    limit,
    offset,
  });
  return ok(res, { staff: rows }, { meta: buildOffsetMeta({ page, limit, total }) });
});

export const getOne = catchAsync(async (req, res) => {
  const staff = await service.getStaff({ tenantId: req.tenantId, id: req.params.id });
  return ok(res, { staff });
});

export const create = catchAsync(async (req, res) => {
  const staff = await service.createStaff(req);
  return created(res, { staff }, { message: 'Staff member added' });
});

export const update = catchAsync(async (req, res) => {
  const staff = await service.updateStaff(req);
  return ok(res, { staff }, { message: 'Staff member updated' });
});

export const resetPassword = catchAsync(async (req, res) => {
  await service.resetPassword(req);
  return ok(res, null, { message: 'Password reset' });
});

export const remove = catchAsync(async (req, res) => {
  await service.deleteStaff(req);
  return noContent(res);
});

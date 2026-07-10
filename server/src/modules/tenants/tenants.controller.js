import catchAsync from '../../shared/catchAsync.js';
import { ok } from '../../shared/ApiResponse.js';
import { parseOffsetPagination, buildOffsetMeta } from '../../shared/pagination.js';
import * as service from './tenants.service.js';

/* ── Restaurant Admin: own restaurant ── */
export const getMine = catchAsync(async (req, res) => {
  const tenant = await service.getMyTenant(req.tenantId);
  return ok(res, { tenant });
});

export const updateMine = catchAsync(async (req, res) => {
  const tenant = await service.updateMyTenant(req);
  return ok(res, { tenant }, { message: 'Restaurant profile updated' });
});

/* ── Super Admin: platform ── */
export const list = catchAsync(async (req, res) => {
  const { limit, offset, page } = parseOffsetPagination(req.query);
  const { rows, total } = await service.listTenants({
    status: req.query.status,
    search: req.query.search,
    limit,
    offset,
    page,
  });
  return ok(res, { tenants: rows }, { meta: buildOffsetMeta({ page, limit, total }) });
});

export const getOne = catchAsync(async (req, res) => {
  const tenant = await service.getTenant(req.params.id);
  return ok(res, { tenant });
});

export const setStatus = catchAsync(async (req, res) => {
  const tenant = await service.setTenantStatus(req, req.params.id, req.body.status);
  return ok(res, { tenant }, { message: `Restaurant ${req.body.status.toLowerCase()}` });
});

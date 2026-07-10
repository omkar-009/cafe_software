import catchAsync from '../../shared/catchAsync.js';
import { ok, created, noContent } from '../../shared/ApiResponse.js';
import * as service from './categories.service.js';

export const list = catchAsync(async (req, res) => {
  const categories = await service.listCategories({
    tenantId: req.tenantId,
    includeInactive: req.query.includeInactive,
  });
  return ok(res, { categories });
});

export const getOne = catchAsync(async (req, res) => {
  const category = await service.getCategory({ tenantId: req.tenantId, id: req.params.id });
  return ok(res, { category });
});

export const create = catchAsync(async (req, res) => {
  const category = await service.createCategory(req);
  return created(res, { category }, { message: 'Category created' });
});

export const update = catchAsync(async (req, res) => {
  const category = await service.updateCategory(req);
  return ok(res, { category }, { message: 'Category updated' });
});

export const remove = catchAsync(async (req, res) => {
  await service.deleteCategory(req);
  return noContent(res);
});

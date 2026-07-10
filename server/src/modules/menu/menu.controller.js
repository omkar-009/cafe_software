import catchAsync from '../../shared/catchAsync.js';
import { ok, created, noContent } from '../../shared/ApiResponse.js';
import { parseOffsetPagination, buildOffsetMeta } from '../../shared/pagination.js';
import * as service from './menu.service.js';

export const list = catchAsync(async (req, res) => {
  const { limit, offset, page } = parseOffsetPagination(req.query);
  const { rows, total } = await service.listItems({
    tenantId: req.tenantId,
    categoryId: req.query.categoryId,
    foodType: req.query.foodType,
    search: req.query.search,
    availableOnly: req.query.availableOnly,
    limit,
    offset,
  });
  return ok(res, { items: rows }, { meta: buildOffsetMeta({ page, limit, total }) });
});

export const getOne = catchAsync(async (req, res) => {
  const item = await service.getItem({ tenantId: req.tenantId, id: req.params.id });
  return ok(res, { item });
});

export const create = catchAsync(async (req, res) => {
  const item = await service.createItem(req);
  return created(res, { item }, { message: 'Menu item created' });
});

export const update = catchAsync(async (req, res) => {
  const item = await service.updateItem(req);
  return ok(res, { item }, { message: 'Menu item updated' });
});

export const toggle = catchAsync(async (req, res) => {
  const item = await service.toggleItem(req);
  return ok(res, { item }, { message: 'Menu item updated' });
});

export const remove = catchAsync(async (req, res) => {
  await service.deleteItem(req);
  return noContent(res);
});

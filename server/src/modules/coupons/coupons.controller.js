import catchAsync from '../../shared/catchAsync.js';
import { ok, created, noContent } from '../../shared/ApiResponse.js';
import * as service from './coupons.service.js';

export const list = catchAsync(async (req, res) => {
  const coupons = await service.listCoupons({ tenantId: req.tenantId, activeOnly: req.query.activeOnly });
  return ok(res, { coupons });
});
export const getOne = catchAsync(async (req, res) => {
  const coupon = await service.getCoupon({ tenantId: req.tenantId, id: req.params.id });
  return ok(res, { coupon });
});
export const create = catchAsync(async (req, res) => {
  const coupon = await service.createCoupon(req);
  return created(res, { coupon }, { message: 'Coupon created' });
});
export const update = catchAsync(async (req, res) => {
  const coupon = await service.updateCoupon(req);
  return ok(res, { coupon }, { message: 'Coupon updated' });
});
export const remove = catchAsync(async (req, res) => {
  await service.deleteCoupon(req);
  return noContent(res);
});

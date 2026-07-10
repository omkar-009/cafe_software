import catchAsync from '../../shared/catchAsync.js';
import { ok, created } from '../../shared/ApiResponse.js';
import { parseOffsetPagination, buildOffsetMeta } from '../../shared/pagination.js';
import { getMyTenant } from '../tenants/tenants.service.js';
import * as service from './orders.service.js';

export const list = catchAsync(async (req, res) => {
  const { limit, offset, page } = parseOffsetPagination(req.query);
  const { rows, total } = await service.listOrders({
    tenantId: req.tenantId,
    status: req.query.status,
    paymentStatus: req.query.paymentStatus,
    tableId: req.query.tableId,
    waiterId: req.query.waiterId,
    search: req.query.search,
    from: req.query.from,
    to: req.query.to,
    limit,
    offset,
  });
  return ok(res, { orders: rows }, { meta: buildOffsetMeta({ page, limit, total }) });
});

export const kitchenQueue = catchAsync(async (req, res) => {
  const orders = await service.kitchenQueue({ tenantId: req.tenantId });
  return ok(res, { orders });
});

export const getOne = catchAsync(async (req, res) => {
  const order = await service.getOrder({ tenantId: req.tenantId, id: req.params.id });
  return ok(res, { order });
});

export const create = catchAsync(async (req, res) => {
  const tenant = await getMyTenant(req.tenantId);
  const order = await service.createOrder({
    tenantId: req.tenantId,
    cart: req.body.cart,
    tableId: req.body.tableId,
    floorId: req.body.floorId,
    orderType: req.body.orderType,
    couponCode: req.body.couponCode,
    customer: req.body.customer,
    customerNote: req.body.customerNote,
    waiterId: req.body.waiterId,
    createdBy: req.user.id,
    tenantSettings: tenant.settings || {},
    actor: { id: req.user.id, role: req.user.role, name: req.user.fullName },
    client: req.clientCtx,
  });
  return created(res, { order }, { message: `Order ${order.order_number} placed` });
});

export const changeStatus = catchAsync(async (req, res) => {
  const order = await service.changeStatus(req, { id: req.params.id, status: req.body.status });
  return ok(res, { order }, { message: `Order marked ${req.body.status}` });
});

export const serve = catchAsync(async (req, res) => {
  const order = await service.serveOrder(req, { id: req.params.id });
  return ok(res, { order }, { message: 'Order served' });
});

export const cancel = catchAsync(async (req, res) => {
  const order = await service.cancelOrder(req, { id: req.params.id, reason: req.body.reason });
  return ok(res, { order }, { message: 'Order cancelled' });
});

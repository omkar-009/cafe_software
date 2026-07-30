import dayjs from 'dayjs';
import catchAsync from '../../shared/catchAsync.js';
import { ok, created } from '../../shared/ApiResponse.js';
import { parseOffsetPagination, buildOffsetMeta } from '../../shared/pagination.js';
import { sendExport } from '../../shared/export.js';
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

export const exportOrders = catchAsync(async (req, res) => {
  const { rows } = await service.listOrders({
    tenantId: req.tenantId,
    status: req.query.status,
    paymentStatus: req.query.paymentStatus,
    from: req.query.from,
    to: req.query.to,
    limit: 10000,
    offset: 0,
  });
  const data = rows.map((o) => ({
    order_number: o.order_number,
    date: dayjs(o.created_at).format('YYYY-MM-DD HH:mm'),
    table: o.table_number || '',
    items: o.item_count,
    subtotal: o.subtotal,
    discount: o.discount_amount,
    tax: o.tax_amount,
    service_charge: o.service_charge,
    total: o.total_amount,
    status: o.status,
    payment_status: o.payment_status,
  }));
  return sendExport(res, {
    format: req.query.format === 'csv' ? 'csv' : 'xlsx',
    filename: `orders-${dayjs().format('YYYY-MM-DD')}`,
    sheetName: 'Orders',
    columns: [
      { header: 'Order', key: 'order_number' }, { header: 'Date', key: 'date' },
      { header: 'Table', key: 'table' }, { header: 'Items', key: 'items' },
      { header: 'Subtotal', key: 'subtotal' }, { header: 'Discount', key: 'discount' },
      { header: 'Tax', key: 'tax' }, { header: 'Service', key: 'service_charge' },
      { header: 'Total', key: 'total' }, { header: 'Status', key: 'status' },
      { header: 'Payment', key: 'payment_status' },
    ],
    rows: data,
  });
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

export const adminUpdate = catchAsync(async (req, res) => {
  const order = await service.adminUpdateOrder(req, {
    id: req.params.id,
    status: req.body.status,
    customerNote: req.body.customerNote,
    priority: req.body.priority,
    items: req.body.items,
    removeItemIds: req.body.removeItemIds,
  });
  return ok(res, { order }, { message: 'Order updated' });
});

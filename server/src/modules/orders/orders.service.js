import { withTransaction } from '../../config/database.js';
import ApiError from '../../shared/ApiError.js';
import { ORDER_STATUS, PAYMENT_STATUS, ROLES, AUDIT_MODULE } from '../../shared/constants.js';
import { recordAudit, auditFromRequest } from '../audit/audit.service.js';
import { evaluateCoupon } from '../coupons/coupons.service.js';
import { incrementUsage as incrementCouponUsage } from '../coupons/coupons.repository.js';
import { notify } from '../notifications/notifications.service.js';
import { emitToRole, emitToTenant, emitToOrder } from '../../realtime/socket.js';
import { priceOrder } from './orders.pricing.js';
import * as repo from './orders.repository.js';

const pad = (n) => String(n).padStart(5, '0');

/**
 * Create an order. Used by both staff and the public (customer QR) flow.
 * All money is computed server-side from the DB catalog — never trusted from
 * the client.
 */
export async function createOrder({
  tenantId, cart, tableId, floorId, orderType = 'DINE_IN', couponCode, customer,
  customerNote, waiterId, createdBy, tenantSettings = {}, actor, client,
}) {
  const itemIds = [...new Set(cart.map((c) => c.menuItemId))];
  const variantIds = [...new Set(cart.map((c) => c.variantId).filter(Boolean))];
  const optionIds = [...new Set(cart.flatMap((c) => c.addonOptionIds || []))];

  const order = await withTransaction(async (q) => {
    const [items, variants, addons] = await Promise.all([
      repo.getPricingItems({ tenantId, itemIds, q }),
      repo.getVariants({ tenantId, variantIds, q }),
      repo.getAddonOptions({ tenantId, optionIds, q }),
    ]);
    const itemsById = new Map(items.map((i) => [i.id, i]));
    const variantsById = new Map(variants.map((v) => [v.id, v]));
    const addonsById = new Map(addons.map((a) => [a.id, a]));

    // Coupon (optional)
    let discount = 0;
    let coupon = null;
    const provisional = priceOrder({ cart, itemsById, variantsById, addonsById });
    if (couponCode) {
      const evalResult = await evaluateCoupon({ tenantId, code: couponCode, subtotal: provisional.subtotal, q });
      discount = evalResult.discount;
      coupon = evalResult.coupon;
    }

    const priced = priceOrder({
      cart, itemsById, variantsById, addonsById,
      discount,
      serviceChargeRate: tenantSettings.enableServiceCharge ? Number(tenantSettings.serviceChargeRate || 0) : 0,
    });

    const seq = await repo.nextCounter({ tenantId, key: 'order', q });
    const orderNumber = `ORD-${pad(seq)}`;
    const customerId = customer ? await repo.upsertCustomer({ tenantId, name: customer.name, phone: customer.phone, q }) : null;

    const created = await repo.insertOrder({
      tenantId,
      data: {
        orderNumber, tableId, floorId, customerId, waiterId,
        status: ORDER_STATUS.PENDING, orderType,
        subtotal: priced.subtotal, taxAmount: priced.taxAmount, discountAmount: priced.discountAmount,
        serviceCharge: priced.serviceCharge, totalAmount: priced.totalAmount,
        couponId: coupon?.id, couponCode: coupon?.code, customerNote, createdBy,
      },
      q,
    });

    for (const line of priced.lines) {
      // eslint-disable-next-line no-await-in-loop
      const orderItemId = await repo.insertOrderItem({ tenantId, orderId: created.id, line, q });
      for (const addon of line.addons) {
        // eslint-disable-next-line no-await-in-loop
        await repo.insertOrderItemAddon({ tenantId, orderItemId, addon, q });
      }
    }

    if (coupon) await incrementCouponUsage({ id: coupon.id, q });

    await recordAudit({
      tenantId, module: AUDIT_MODULE.ORDER, action: 'CREATE', recordId: created.id,
      description: `Order ${orderNumber} placed (${priced.lines.length} items, total ${priced.totalAmount})`,
      newValues: { orderNumber, total: priced.totalAmount },
      actor, client, q,
    });

    return created;
  });

  const full = await repo.findFullById({ tenantId, id: order.id });

  // Real-time: notify kitchen + admin dashboards
  emitToRole(tenantId, ROLES.KITCHEN, 'order:new', full);
  emitToRole(tenantId, ROLES.RESTAURANT_ADMIN, 'order:new', full);
  emitToTenant(tenantId, 'orders:changed', { orderId: full.id });
  await notify({
    tenantId, targetRole: ROLES.KITCHEN, type: 'ORDER_NEW',
    title: `New order ${full.order_number}`,
    body: full.table_number ? `Table ${full.table_number}` : orderType,
    link: `/kitchen/orders/${full.id}`, data: { orderId: full.id },
  });

  return full;
}

/* ── Reads ── */
export async function listOrders(params) {
  return repo.list(params);
}
export async function getOrder({ tenantId, id }) {
  const order = await repo.findFullById({ tenantId, id });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}
export async function kitchenQueue({ tenantId }) {
  return repo.kitchenQueue({
    tenantId,
    statuses: [ORDER_STATUS.PENDING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.DELAYED],
  });
}

/* ── Lifecycle transitions ── */

const TIMESTAMP_FIELD = {
  [ORDER_STATUS.ACCEPTED]: 'accepted_at',
  [ORDER_STATUS.READY]: 'ready_at',
  [ORDER_STATUS.SERVED]: 'served_at',
  [ORDER_STATUS.COMPLETED]: 'completed_at',
  [ORDER_STATUS.CANCELLED]: 'cancelled_at',
};

// Allowed forward transitions (kitchen + waiter workflow).
const ALLOWED = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED, ORDER_STATUS.PREPARING],
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.DELAYED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.DELAYED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELAYED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY]: [ORDER_STATUS.SERVED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SERVED]: [ORDER_STATUS.COMPLETED],
};

export async function changeStatus(req, { id, status }) {
  const current = await repo.findFullById({ tenantId: req.tenantId, id });
  if (!current) throw ApiError.notFound('Order not found');

  const allowed = ALLOWED[current.status] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(`Cannot change order from ${current.status} to ${status}`);
  }

  const updated = await repo.updateStatus({
    tenantId: req.tenantId, id, status,
    timestampField: TIMESTAMP_FIELD[status], actorId: req.user.id,
  });

  await auditFromRequest(req, {
    module: AUDIT_MODULE.ORDER, action: `STATUS_${status}`, recordId: id,
    description: `Order ${current.order_number}: ${current.status} → ${status}`,
    oldValues: { status: current.status }, newValues: { status },
  });

  const full = await repo.findFullById({ tenantId: req.tenantId, id });
  emitToTenant(req.tenantId, 'order:updated', full);
  emitToOrder(id, 'order:status', { orderId: id, status });

  // Targeted notifications
  if (status === ORDER_STATUS.READY) {
    await notify({
      tenantId: req.tenantId, targetRole: ROLES.WAITER, type: 'ORDER_READY',
      title: `Order ${current.order_number} is ready`,
      body: current.table_number ? `Serve table ${current.table_number}` : null,
      link: `/waiter/orders/${id}`, data: { orderId: id },
    });
  }
  return full;
}

export async function serveOrder(req, { id }) {
  return changeStatus(req, { id, status: ORDER_STATUS.SERVED });
}

export async function cancelOrder(req, { id, reason }) {
  const current = await repo.findFullById({ tenantId: req.tenantId, id });
  if (!current) throw ApiError.notFound('Order not found');
  if ([ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(current.status)) {
    throw ApiError.badRequest(`Order is already ${current.status.toLowerCase()}`);
  }
  const updated = await repo.updateStatus({
    tenantId: req.tenantId, id, status: ORDER_STATUS.CANCELLED,
    timestampField: 'cancelled_at', actorId: req.user.id,
  });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.ORDER, action: 'CANCEL', recordId: id,
    description: `Order ${current.order_number} cancelled${reason ? `: ${reason}` : ''}`,
    oldValues: { status: current.status }, newValues: { status: ORDER_STATUS.CANCELLED, reason },
  });
  const full = await repo.findFullById({ tenantId: req.tenantId, id });
  emitToTenant(req.tenantId, 'order:updated', full);
  emitToOrder(id, 'order:status', { orderId: id, status: ORDER_STATUS.CANCELLED });
  return full;
}

/** Public order tracking (customer, no auth) — minimal safe projection. */
export async function trackOrder({ tenantId, id }) {
  const order = await repo.findFullById({ tenantId, id });
  if (!order) throw ApiError.notFound('Order not found');
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    tableNumber: order.table_number,
    totalAmount: order.total_amount,
    items: order.items.map((i) => ({ name: i.name_snapshot, quantity: i.quantity, status: i.status })),
    createdAt: order.created_at,
  };
}

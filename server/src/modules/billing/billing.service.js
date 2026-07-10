import { withTransaction } from '../../config/database.js';
import ApiError from '../../shared/ApiError.js';
import { ORDER_STATUS, PAYMENT_STATUS, ROLES, AUDIT_MODULE } from '../../shared/constants.js';
import { recordAudit, auditFromRequest } from '../audit/audit.service.js';
import { notify } from '../notifications/notifications.service.js';
import { emitToTenant, emitToOrder } from '../../realtime/socket.js';
import * as orderRepo from '../orders/orders.repository.js';
import { getMyTenant } from '../tenants/tenants.service.js';
import { renderInvoicePdf } from './billing.pdf.js';
import * as repo from './billing.repository.js';

const pad = (n) => String(n).padStart(5, '0');

/** Build the immutable invoice snapshot from an order + tenant branding. */
function buildSnapshot({ tenant, order, invoiceNumber }) {
  return {
    invoiceNumber,
    issuedAt: new Date().toISOString(),
    tenant: {
      name: tenant.name,
      address: tenant.address,
      gstNumber: tenant.gst_number,
      currency: tenant.currency,
      currencySymbol: tenant.settings?.currencySymbol || '₹',
      logoUrl: tenant.logo_url,
      menuFooter: tenant.menu_footer,
    },
    order: {
      orderNumber: order.order_number,
      tableNumber: order.table_number,
      orderType: order.order_type,
      customerName: order.customer_name,
      couponCode: order.coupon_code,
    },
    items: order.items.map((i) => ({
      name: i.name_snapshot,
      variant: i.variant_snapshot,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
      addons: i.addons?.map((a) => ({ name: a.name_snapshot, price: a.price })) || [],
    })),
    totals: {
      subtotal: order.subtotal,
      taxAmount: order.tax_amount,
      discountAmount: order.discount_amount,
      serviceCharge: order.service_charge,
      totalAmount: order.total_amount,
    },
  };
}

/**
 * Ensure an invoice exists for an order (idempotent). Returns the invoice row.
 */
export async function ensureInvoice({ tenantId, orderId, actor, client, q }) {
  const runner = q
    ? async (fn) => fn(q)
    : withTransaction;

  return runner(async (qq) => {
    const existing = await repo.findInvoiceByOrder({ tenantId, orderId, q: qq });
    if (existing) return existing;

    const order = await orderRepo.findFullById({ tenantId, id: orderId });
    if (!order) throw ApiError.notFound('Order not found');
    const tenant = await getMyTenant(tenantId);

    const seq = await orderRepo.nextCounter({ tenantId, key: 'invoice', q: qq });
    const invoiceNumber = `INV-${pad(seq)}`;
    const snapshot = buildSnapshot({ tenant, order, invoiceNumber });
    const invoice = await repo.insertInvoice({ tenantId, orderId, invoiceNumber, snapshot, actorId: actor?.id, q: qq });

    await recordAudit({
      tenantId, module: AUDIT_MODULE.PAYMENT, action: 'INVOICE_GENERATE', recordId: invoice.id,
      description: `Invoice ${invoiceNumber} generated for ${order.order_number}`,
      actor, client, q: qq,
    });
    return invoice;
  });
}

/**
 * Complete payment for an order: record payment, mark paid + completed, and
 * generate the invoice — all atomically.
 */
export async function completePayment(req, { orderId, method, amount, reference }) {
  const order = await orderRepo.findFullById({ tenantId: req.tenantId, id: orderId });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.payment_status === PAYMENT_STATUS.PAID) throw ApiError.badRequest('Order is already paid');
  if (order.status === ORDER_STATUS.CANCELLED) throw ApiError.badRequest('Cannot bill a cancelled order');

  const expected = Number(order.total_amount);
  if (amount != null && Number(amount) < expected) {
    throw ApiError.badRequest(`Amount ${amount} is less than the order total ${expected}`);
  }

  const result = await withTransaction(async (q) => {
    const payment = await repo.insertPayment({
      tenantId: req.tenantId, orderId, amount: expected, method, reference, actorId: req.user.id, q,
    });
    await orderRepo.setPaymentStatus({ tenantId: req.tenantId, id: orderId, paymentStatus: PAYMENT_STATUS.PAID, q });
    // Auto-complete served orders on payment.
    if (order.status === ORDER_STATUS.SERVED) {
      await orderRepo.updateStatus({
        tenantId: req.tenantId, id: orderId, status: ORDER_STATUS.COMPLETED,
        timestampField: 'completed_at', actorId: req.user.id, q,
      });
    }
    const invoice = await ensureInvoice({
      tenantId: req.tenantId, orderId,
      actor: { id: req.user.id, role: req.user.role, name: req.user.fullName },
      client: req.clientCtx, q,
    });
    return { payment, invoice };
  });

  await auditFromRequest(req, {
    module: AUDIT_MODULE.PAYMENT, action: 'PAYMENT_COMPLETE', recordId: orderId,
    description: `Payment ${expected} (${method}) for order ${order.order_number}`,
    newValues: { method, amount: expected },
  });

  const full = await orderRepo.findFullById({ tenantId: req.tenantId, id: orderId });
  emitToTenant(req.tenantId, 'order:updated', full);
  emitToOrder(orderId, 'order:status', { orderId, status: full.status, paymentStatus: PAYMENT_STATUS.PAID });
  await notify({
    tenantId: req.tenantId, targetRole: ROLES.RESTAURANT_ADMIN, type: 'PAYMENT_DONE',
    title: `Payment received — ${order.order_number}`, body: `${method} • ${expected}`,
    link: `/orders/${orderId}`, data: { orderId },
  });

  return { order: full, invoice: result.invoice };
}

/** Generate (if needed) and return the invoice PDF buffer. */
export async function getInvoicePdf(req, { orderId }) {
  const invoice = await ensureInvoice({
    tenantId: req.tenantId, orderId,
    actor: { id: req.user.id, role: req.user.role, name: req.user.fullName },
    client: req.clientCtx,
  });
  const pdf = await renderInvoicePdf(invoice.snapshot);
  await repo.incrementPrintCount({ tenantId: req.tenantId, id: invoice.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.PAYMENT, action: 'INVOICE_PRINT', recordId: invoice.id,
    description: `Printed/downloaded invoice ${invoice.invoice_number}`,
  });
  return { invoice, pdf };
}

export async function getInvoice(req, { orderId }) {
  const invoice = await ensureInvoice({
    tenantId: req.tenantId, orderId,
    actor: { id: req.user.id, role: req.user.role, name: req.user.fullName },
    client: req.clientCtx,
  });
  return invoice;
}

import ApiError from '../../shared/ApiError.js';
import { verifyQrSignature } from '../../shared/security.js';
import { TENANT_STATUS } from '../../shared/constants.js';
import * as tablesRepo from '../tables/tables.repository.js';
import * as tenantsRepo from '../tenants/tenants.repository.js';
import * as menuRepo from '../menu/menu.repository.js';
import * as categoriesRepo from '../categories/categories.repository.js';
import * as couponsRepo from '../coupons/coupons.repository.js';
import { createOrder, trackOrder } from '../orders/orders.service.js';
import { previewCoupon } from '../coupons/coupons.service.js';

/** Decode + verify a QR deep-link payload, returning the resolved table context. */
function decodePayload(encoded) {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw ApiError.badRequest('Invalid QR code');
  }
  if (!verifyQrSignature(payload)) throw ApiError.badRequest('This QR code is invalid or tampered');
  return payload;
}

async function resolveContext(encoded) {
  const payload = decodePayload(encoded);
  const table = await tablesRepo.findByQrToken(payload.k);
  if (!table || table.id !== payload.b || table.tenant_id !== payload.t) {
    throw ApiError.notFound('Table not found for this QR code');
  }
  if (table.qr_version !== payload.v) {
    throw ApiError.badRequest('This QR code has expired — please scan the latest code on your table');
  }
  const tenant = await tenantsRepo.findById(table.tenant_id);
  if (!tenant) throw ApiError.notFound('Restaurant not found');
  if (![TENANT_STATUS.ACTIVE, TENANT_STATUS.TRIAL].includes(tenant.status)) {
    throw ApiError.forbidden('This restaurant is not currently accepting orders');
  }
  return { tenant, table };
}

function publicBranding(tenant) {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    logoUrl: tenant.logo_url,
    coverUrl: tenant.cover_url,
    brandColor: tenant.brand_color,
    menuHeader: tenant.menu_header,
    menuFooter: tenant.menu_footer,
    currency: tenant.currency,
    currencySymbol: tenant.settings?.currencySymbol || '₹',
  };
}

/** Resolve a scanned QR → restaurant branding + table + full menu. */
export async function resolveQr(encoded) {
  const { tenant, table } = await resolveContext(encoded);
  const [menu, coupons] = await Promise.all([
    buildMenu(tenant.id),
    couponsRepo.listActivePublic({ tenantId: tenant.id }),
  ]);
  return {
    restaurant: publicBranding(tenant),
    table: { id: table.id, tableNumber: table.table_number, floorId: table.floor_id },
    offers: coupons,
    ...menu,
  };
}

async function buildMenu(tenantId) {
  const [categories, itemsResult] = await Promise.all([
    categoriesRepo.list({ tenantId, includeInactive: false }),
    menuRepo.list({ tenantId, availableOnly: true, limit: 500, offset: 0 }),
  ]);
  // Attach variants/addons per item (full detail for ordering).
  const items = await Promise.all(
    itemsResult.rows.map((row) => menuRepo.findFullById({ tenantId, id: row.id })),
  );
  return { categories, items };
}

/**
 * Place an order from the customer app. The QR payload `d` is re-verified
 * server-side so tenant + table are authoritative (never trusted from body).
 */
export async function placeOrder({ encoded, cart, couponCode, customer, customerNote, client }) {
  const { tenant, table } = await resolveContext(encoded);
  const order = await createOrder({
    tenantId: tenant.id,
    cart,
    tableId: table.id,
    floorId: table.floor_id,
    orderType: 'DINE_IN',
    couponCode,
    customer,
    customerNote,
    tenantSettings: tenant.settings || {},
    actor: { id: null, role: 'CUSTOMER', name: customer?.name || 'Guest' },
    client,
  });
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    totalAmount: order.total_amount,
  };
}

export async function track({ encoded, orderId }) {
  const { tenant } = await resolveContext(encoded);
  return trackOrder({ tenantId: tenant.id, id: orderId });
}

export async function coupon({ encoded, code, subtotal }) {
  const { tenant } = await resolveContext(encoded);
  return previewCoupon({ tenantId: tenant.id, code, subtotal });
}

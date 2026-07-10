import ApiError from '../../shared/ApiError.js';
import { AUDIT_MODULE, COUPON_TYPE } from '../../shared/constants.js';
import { auditFromRequest } from '../audit/audit.service.js';
import * as repo from './coupons.repository.js';

export const listCoupons = ({ tenantId, activeOnly }) => repo.list({ tenantId, activeOnly });

export async function getCoupon({ tenantId, id }) {
  const coupon = await repo.findById({ tenantId, id });
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return coupon;
}

export async function createCoupon(req) {
  const existing = await repo.findByCode({ tenantId: req.tenantId, code: req.body.code });
  if (existing) throw ApiError.conflict('A coupon with this code already exists');
  const coupon = await repo.create({ tenantId: req.tenantId, data: req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.COUPON, action: 'CREATE', recordId: coupon.id,
    description: `Created coupon "${coupon.code}"`, newValues: { code: coupon.code, type: coupon.type, value: coupon.value },
  });
  return coupon;
}

export async function updateCoupon(req) {
  const before = await repo.findById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Coupon not found');
  const coupon = await repo.update({ tenantId: req.tenantId, id: req.params.id, data: req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.COUPON, action: 'UPDATE', recordId: coupon.id,
    description: `Updated coupon "${coupon.code}"`,
  });
  return coupon;
}

export async function deleteCoupon(req) {
  const before = await repo.findById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Coupon not found');
  await repo.softDelete({ tenantId: req.tenantId, id: req.params.id, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.COUPON, action: 'DELETE', recordId: before.id, description: `Deleted coupon "${before.code}"`,
  });
}

/**
 * Validate a coupon against an order subtotal and return the computed discount.
 * Pure/reusable — also called by the order pricing engine. Throws on invalid.
 *
 * @returns {{ coupon, discount }}
 */
export async function evaluateCoupon({ tenantId, code, subtotal, q }) {
  const coupon = await repo.findByCode({ tenantId, code, q });
  if (!coupon || !coupon.is_active) throw ApiError.badRequest('Invalid or inactive coupon');

  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) throw ApiError.badRequest('Coupon is not active yet');
  if (coupon.expires_at && new Date(coupon.expires_at) < now) throw ApiError.badRequest('This coupon has expired');
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    throw ApiError.badRequest('This coupon has reached its usage limit');
  }
  if (subtotal < Number(coupon.min_order_amount)) {
    throw ApiError.badRequest(`Minimum order of ${coupon.min_order_amount} required for this coupon`);
  }

  let discount;
  if (coupon.type === COUPON_TYPE.PERCENTAGE) {
    discount = (subtotal * Number(coupon.value)) / 100;
    if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
  } else {
    discount = Number(coupon.value);
  }
  discount = Math.min(discount, subtotal); // never exceed subtotal
  return { coupon, discount: round2(discount) };
}

export async function previewCoupon({ tenantId, code, subtotal }) {
  const { coupon, discount } = await evaluateCoupon({ tenantId, code, subtotal });
  return { code: coupon.code, type: coupon.type, value: coupon.value, discount };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

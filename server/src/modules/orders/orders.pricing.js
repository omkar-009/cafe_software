/**
 * Pure order pricing engine.
 *
 * Given the authoritative catalog (prices fetched from DB — never trusted from
 * the client) and the requested cart, it computes per-line and order totals:
 *
 *   unit_price   = item.price + variant.price_delta
 *   addons_total = Σ selected addon option prices
 *   line_total   = (unit_price + addons_total) * quantity
 *   tax_amount   = Σ line_total * (tax_rate / 100)          (tax-exclusive)
 *   discount     = coupon discount (already evaluated)
 *   service      = (subtotal - discount) * serviceChargeRate
 *   total        = subtotal + tax + service - discount
 *
 * Throws ApiError for unavailable / unknown items so the caller aborts.
 */
import ApiError from '../../shared/ApiError.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function priceOrder({ cart, itemsById, variantsById, addonsById, discount = 0, serviceChargeRate = 0 }) {
  if (!cart.length) throw ApiError.badRequest('Cart is empty');

  const lines = [];
  let subtotal = 0;
  let taxAmount = 0;

  for (const entry of cart) {
    const item = itemsById.get(entry.menuItemId);
    if (!item) throw ApiError.badRequest(`Menu item ${entry.menuItemId} is not available`);
    if (!item.is_available || item.is_out_of_stock) {
      throw ApiError.badRequest(`"${item.name}" is currently unavailable`);
    }

    let unitPrice = Number(item.price);
    let variantSnapshot = null;
    if (entry.variantId) {
      const variant = variantsById.get(entry.variantId);
      if (!variant || variant.menu_item_id !== item.id) {
        throw ApiError.badRequest(`Invalid variant for "${item.name}"`);
      }
      unitPrice += Number(variant.price_delta);
      variantSnapshot = variant.name;
    }

    const addons = [];
    let addonsTotal = 0;
    for (const optId of entry.addonOptionIds || []) {
      const opt = addonsById.get(optId);
      if (!opt || opt.menu_item_id !== item.id) {
        throw ApiError.badRequest(`Invalid add-on for "${item.name}"`);
      }
      addons.push({ id: opt.id, name: opt.name, price: Number(opt.price) });
      addonsTotal += Number(opt.price);
    }

    const qty = entry.quantity;
    const lineBase = round2((unitPrice + addonsTotal) * qty);
    const lineTax = round2(lineBase * (Number(item.tax_rate) / 100));
    subtotal += lineBase;
    taxAmount += lineTax;

    lines.push({
      menuItemId: item.id,
      variantId: entry.variantId || null,
      nameSnapshot: item.name,
      variantSnapshot,
      unitPrice: round2(unitPrice),
      quantity: qty,
      addonsTotal: round2(addonsTotal),
      taxRate: Number(item.tax_rate),
      lineTotal: lineBase,
      note: entry.note || null,
      addons,
      prepTime: item.prep_time_mins,
    });
  }

  subtotal = round2(subtotal);
  taxAmount = round2(taxAmount);
  const cappedDiscount = round2(Math.min(discount, subtotal));
  const serviceCharge = round2(((subtotal - cappedDiscount) * serviceChargeRate) / 100);
  const totalAmount = round2(subtotal + taxAmount + serviceCharge - cappedDiscount);

  return {
    lines,
    subtotal,
    taxAmount,
    discountAmount: cappedDiscount,
    serviceCharge,
    totalAmount,
  };
}

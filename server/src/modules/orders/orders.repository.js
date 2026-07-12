import { query } from '../../config/database.js';

/* ── Pricing catalog reads (tenant-scoped, only what's needed to price) ── */

export async function getPricingItems({ tenantId, itemIds, q = query }) {
  if (!itemIds.length) return [];
  const { rows } = await q(
    `SELECT id, name, price, tax_rate, prep_time_mins, is_available, is_out_of_stock
       FROM menu_items
      WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
    [tenantId, itemIds],
  );
  return rows;
}

export async function getVariants({ tenantId, variantIds, q = query }) {
  if (!variantIds.length) return [];
  const { rows } = await q(
    `SELECT v.id, v.menu_item_id, v.name, v.price_delta
       FROM menu_variants v
      WHERE v.tenant_id = $1 AND v.id = ANY($2::uuid[])`,
    [tenantId, variantIds],
  );
  return rows;
}

export async function getAddonOptions({ tenantId, optionIds, q = query }) {
  if (!optionIds.length) return [];
  const { rows } = await q(
    `SELECT o.id, o.group_id, o.name, o.price, g.menu_item_id
       FROM addon_options o
       JOIN addon_groups g ON g.id = o.group_id
      WHERE o.tenant_id = $1 AND o.id = ANY($2::uuid[]) AND o.is_available = true`,
    [tenantId, optionIds],
  );
  return rows;
}

/* ── Counters ── */
export async function nextCounter({ tenantId, key, q }) {
  const { rows } = await q(
    `INSERT INTO tenant_counters (tenant_id, counter_key, value) VALUES ($1,$2,1)
     ON CONFLICT (tenant_id, counter_key) DO UPDATE SET value = tenant_counters.value + 1
     RETURNING value`,
    [tenantId, key],
  );
  return rows[0].value;
}

/* ── Order writes ── */

export async function insertOrder({ tenantId, data, q }) {
  const { rows } = await q(
    `INSERT INTO orders
      (tenant_id, order_number, table_id, floor_id, customer_id, waiter_id, status, order_type,
       subtotal, tax_amount, discount_amount, service_charge, total_amount,
       coupon_id, coupon_code, customer_note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      tenantId, data.orderNumber, data.tableId || null, data.floorId || null,
      data.customerId || null, data.waiterId || null, data.status, data.orderType,
      data.subtotal, data.taxAmount, data.discountAmount, data.serviceCharge, data.totalAmount,
      data.couponId || null, data.couponCode || null, data.customerNote || null, data.createdBy || null,
    ],
  );
  return rows[0];
}

export async function insertOrderItem({ tenantId, orderId, line, q }) {
  const { rows } = await q(
    `INSERT INTO order_items
      (tenant_id, order_id, menu_item_id, variant_id, name_snapshot, variant_snapshot,
       unit_price, quantity, addons_total, tax_rate, line_total, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      tenantId, orderId, line.menuItemId, line.variantId || null, line.nameSnapshot,
      line.variantSnapshot || null, line.unitPrice, line.quantity, line.addonsTotal,
      line.taxRate, line.lineTotal, line.note || null,
    ],
  );
  return rows[0].id;
}

export async function insertOrderItemAddon({ tenantId, orderItemId, addon, q }) {
  await q(
    `INSERT INTO order_item_addons (tenant_id, order_item_id, addon_option_id, name_snapshot, price)
     VALUES ($1,$2,$3,$4,$5)`,
    [tenantId, orderItemId, addon.id, addon.name, addon.price],
  );
}

/* ── Reads ── */

const ORDER_COLS = `o.id, o.tenant_id, o.order_number, o.table_id, o.floor_id, o.customer_id,
  o.waiter_id, o.status, o.order_type, o.priority, o.subtotal, o.tax_amount, o.discount_amount,
  o.service_charge, o.total_amount, o.coupon_code, o.payment_status, o.customer_note,
  o.accepted_at, o.ready_at, o.served_at, o.completed_at, o.cancelled_at, o.created_at, o.updated_at`;

export async function list({ tenantId, status, tableId, waiterId, paymentStatus, search, from, to, limit, offset }) {
  const where = ['o.tenant_id = $1', 'o.deleted_at IS NULL'];
  const params = [tenantId];
  const add = (cond, val) => { params.push(val); where.push(cond.replace('?', `$${params.length}`)); };
  if (status) add('o.status = ?', status);
  if (tableId) add('o.table_id = ?', tableId);
  if (waiterId) add('o.waiter_id = ?', waiterId);
  if (paymentStatus) add('o.payment_status = ?', paymentStatus);
  if (search) add('o.order_number ILIKE ?', `%${search}%`);
  if (from) add('o.created_at >= ?', from);
  if (to) add('o.created_at <= ?', to);
  const whereSql = where.join(' AND ');

  const total = await query(`SELECT count(*)::int AS total FROM orders o WHERE ${whereSql}`, params);
  const { rows } = await query(
    `SELECT ${ORDER_COLS}, t.table_number,
            (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
      WHERE ${whereSql}
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows, total: total.rows[0].total };
}

/** Active kitchen queue: orders that still need cooking, oldest first. */
export async function kitchenQueue({ tenantId, statuses }) {
  const { rows } = await query(
    `SELECT ${ORDER_COLS}, t.table_number
       FROM orders o
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
      WHERE o.tenant_id = $1 AND o.deleted_at IS NULL AND o.status = ANY($2)
      ORDER BY o.priority DESC, o.created_at ASC`,
    [tenantId, statuses],
  );
  return withItems(rows);
}

export async function findFullById({ tenantId, id }) {
  const { rows } = await query(
    `SELECT ${ORDER_COLS}, t.table_number, c.name AS customer_name, c.phone AS customer_phone,
            u.full_name AS waiter_name
       FROM orders o
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.waiter_id
      WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL`,
    [id, tenantId],
  );
  if (!rows[0]) return null;
  const [order] = await withItems(rows);
  return order;
}

async function withItems(orders) {
  if (!orders.length) return orders;
  const ids = orders.map((o) => o.id);
  const items = await query(
    `SELECT id, order_id, menu_item_id, name_snapshot, variant_snapshot, unit_price,
            quantity, addons_total, tax_rate, line_total, note, status
       FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY created_at`,
    [ids],
  );
  const itemIds = items.rows.map((i) => i.id);
  let addons = { rows: [] };
  if (itemIds.length) {
    addons = await query(
      'SELECT id, order_item_id, name_snapshot, price FROM order_item_addons WHERE order_item_id = ANY($1::uuid[])',
      [itemIds],
    );
  }
  return orders.map((o) => ({
    ...o,
    items: items.rows
      .filter((i) => i.order_id === o.id)
      .map((i) => ({ ...i, addons: addons.rows.filter((a) => a.order_item_id === i.id) })),
  }));
}

export async function updateStatus({ tenantId, id, status, timestampField, actorId, q = query }) {
  const tsSet = timestampField ? `, ${timestampField} = now()` : '';
  const { rows } = await q(
    `UPDATE orders SET status = $1, updated_by = $2 ${tsSet}
      WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
      RETURNING id, order_number, status, table_id, waiter_id, tenant_id`,
    [status, actorId, id, tenantId],
  );
  return rows[0] || null;
}

/* ── Admin edit helpers ── */

export async function deleteOrderItems({ tenantId, orderId, itemIds, q = query }) {
  if (!itemIds?.length) return;
  await q(
    'DELETE FROM order_items WHERE id = ANY($1::uuid[]) AND order_id = $2 AND tenant_id = $3',
    [itemIds, orderId, tenantId],
  );
}

export async function updateOrderItemQuantity({ tenantId, orderId, orderItemId, quantity, q = query }) {
  // $1 is cast to int in BOTH uses so Postgres deduces a single, consistent type
  // (avoids "inconsistent types deduced for parameter $1").
  await q(
    `UPDATE order_items
        SET quantity = $1::int, line_total = round((unit_price + addons_total) * $1::int, 2)
      WHERE id = $2 AND order_id = $3 AND tenant_id = $4`,
    [quantity, orderItemId, orderId, tenantId],
  );
}

export async function getOrderItemsForRecompute({ tenantId, orderId, q = query }) {
  const { rows } = await q(
    'SELECT line_total, tax_rate FROM order_items WHERE order_id = $1 AND tenant_id = $2',
    [orderId, tenantId],
  );
  return rows;
}

export async function updateOrderMoney({ tenantId, id, subtotal, taxAmount, discount, serviceCharge, totalAmount, q = query }) {
  await q(
    `UPDATE orders SET subtotal = $1, tax_amount = $2, discount_amount = $3,
            service_charge = $4, total_amount = $5
      WHERE id = $6 AND tenant_id = $7`,
    [subtotal, taxAmount, discount, serviceCharge, totalAmount, id, tenantId],
  );
}

/** Update whitelisted order fields; a value of the literal string 'now()' → SQL now(). */
export async function updateOrderFields({ tenantId, id, fields, actorId, q = query }) {
  const allowed = ['status', 'customer_note', 'priority', 'accepted_at', 'ready_at', 'served_at', 'completed_at', 'cancelled_at'];
  const sets = ['updated_by = $1'];
  const params = [actorId];
  for (const [col, val] of Object.entries(fields)) {
    if (!allowed.includes(col)) continue;
    if (val === 'now()') { sets.push(`${col} = now()`); continue; }
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  }
  params.push(id, tenantId);
  await q(
    `UPDATE orders SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length}`,
    params,
  );
}

export async function assignWaiter({ tenantId, id, waiterId, actorId }) {
  const { rows } = await query(
    `UPDATE orders SET waiter_id = $1, updated_by = $2
      WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL RETURNING id`,
    [waiterId, actorId, id, tenantId],
  );
  return rows[0] || null;
}

export async function setPaymentStatus({ tenantId, id, paymentStatus, q = query }) {
  await q(
    'UPDATE orders SET payment_status = $1 WHERE id = $2 AND tenant_id = $3',
    [paymentStatus, id, tenantId],
  );
}

/* ── Customer upsert (dine-in walk-ins / phone) ── */
export async function upsertCustomer({ tenantId, name, phone, q = query }) {
  if (!phone) {
    if (!name) return null;
    const { rows } = await q(
      'INSERT INTO customers (tenant_id, name) VALUES ($1,$2) RETURNING id',
      [tenantId, name],
    );
    return rows[0].id;
  }
  const { rows } = await q(
    `INSERT INTO customers (tenant_id, name, phone, visits_count, last_visit_at)
     VALUES ($1,$2,$3,1,now())
     ON CONFLICT (tenant_id, phone) WHERE phone IS NOT NULL
     DO UPDATE SET visits_count = customers.visits_count + 1,
                   last_visit_at = now(),
                   name = COALESCE(EXCLUDED.name, customers.name)
     RETURNING id`,
    [tenantId, name || null, phone],
  );
  return rows[0].id;
}

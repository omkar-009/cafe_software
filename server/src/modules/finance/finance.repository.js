import { query } from '../../config/database.js';

/**
 * P&L is computed from PAID orders in the range. COGS uses the per-item cost
 * snapshot taken at order time, falling back to the product's current cost_price
 * for historical rows that predate snapshotting.
 */
const PAID_ORDER = `o.tenant_id = $1 AND o.deleted_at IS NULL AND o.payment_status = 'PAID'
  AND o.created_at >= $2 AND o.created_at <= $3`;

const EFFECTIVE_COST = `COALESCE(NULLIF(oi.cost_snapshot,0), mi.cost_price, 0)`;

export async function salesTotals({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT
        COALESCE(sum(o.subtotal - o.discount_amount),0)::float AS net_sales,
        COALESCE(sum(o.tax_amount),0)::float       AS tax_collected,
        COALESCE(sum(o.service_charge),0)::float   AS service_charge,
        COALESCE(sum(o.discount_amount),0)::float  AS discounts,
        COALESCE(sum(o.total_amount),0)::float     AS total_collected,
        count(*)::int                              AS orders_count
       FROM orders o WHERE ${PAID_ORDER}`,
    [tenantId, from, to],
  );
  return rows[0];
}

export async function cogsTotal({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT COALESCE(sum(oi.quantity * ${EFFECTIVE_COST}),0)::float AS cogs
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE ${PAID_ORDER}`,
    [tenantId, from, to],
  );
  return rows[0].cogs;
}

export async function productProfitability({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT
        oi.name_snapshot AS name,
        sum(oi.quantity)::int AS qty,
        COALESCE(sum(oi.line_total),0)::float AS revenue,
        COALESCE(sum(oi.quantity * ${EFFECTIVE_COST}),0)::float AS cost
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE ${PAID_ORDER}
      GROUP BY oi.name_snapshot
      ORDER BY revenue DESC
      LIMIT 100`,
    [tenantId, from, to],
  );
  return rows;
}

/** Daily net-sales + profit series for the trend chart. */
export async function dailyPnl({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT day::date AS day,
            COALESCE(sum(net),0)::float AS net_sales,
            COALESCE(sum(cogs),0)::float AS cogs,
            COALESCE(sum(orders),0)::int AS orders
       FROM (
         SELECT date_trunc('day', o.created_at) AS day,
                (o.subtotal - o.discount_amount) AS net,
                (SELECT COALESCE(sum(oi.quantity * COALESCE(NULLIF(oi.cost_snapshot,0), mi.cost_price,0)),0)
                   FROM order_items oi LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
                  WHERE oi.order_id = o.id) AS cogs,
                1 AS orders
           FROM orders o WHERE ${PAID_ORDER}
       ) t
      GROUP BY day ORDER BY day ASC`,
    [tenantId, from, to],
  );
  return rows;
}

import { query } from '../../config/database.js';

/**
 * Revenue is recognized on PAID orders. All queries are tenant-scoped and use a
 * [from, to] window (defaults applied in the service).
 */

/** Headline KPI cards for the dashboard. */
export async function summary({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT
        count(*) FILTER (WHERE status <> 'CANCELLED')                          AS total_orders,
        count(*) FILTER (WHERE status = 'COMPLETED')                           AS completed_orders,
        count(*) FILTER (WHERE status = 'CANCELLED')                           AS cancelled_orders,
        coalesce(sum(total_amount) FILTER (WHERE payment_status = 'PAID'), 0)  AS revenue,
        coalesce(avg(total_amount) FILTER (WHERE payment_status = 'PAID'), 0)  AS avg_bill_value,
        count(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL)     AS customers
       FROM orders
      WHERE tenant_id = $1 AND deleted_at IS NULL AND created_at BETWEEN $2 AND $3`,
    [tenantId, from, to],
  );
  return rows[0];
}

/** Quick period cards: today / this week / this month / this year revenue. */
export async function periodSales({ tenantId }) {
  const { rows } = await query(
    `SELECT
       coalesce(sum(total_amount) FILTER (WHERE created_at >= date_trunc('day', now())), 0)   AS today,
       coalesce(sum(total_amount) FILTER (WHERE created_at >= date_trunc('week', now())), 0)  AS week,
       coalesce(sum(total_amount) FILTER (WHERE created_at >= date_trunc('month', now())), 0) AS month,
       coalesce(sum(total_amount) FILTER (WHERE created_at >= date_trunc('year', now())), 0)  AS year
      FROM orders
     WHERE tenant_id = $1 AND deleted_at IS NULL AND payment_status = 'PAID'`,
    [tenantId],
  );
  return rows[0];
}

/** Revenue + order count per day across the window. */
export async function salesTimeseries({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT date_trunc('day', created_at)::date AS day,
            count(*) AS orders,
            coalesce(sum(total_amount) FILTER (WHERE payment_status = 'PAID'), 0) AS revenue
       FROM orders
      WHERE tenant_id = $1 AND deleted_at IS NULL AND created_at BETWEEN $2 AND $3
      GROUP BY 1 ORDER BY 1`,
    [tenantId, from, to],
  );
  return rows;
}

/** Order volume by hour of day (peak hours). */
export async function peakHours({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT extract(hour FROM created_at)::int AS hour, count(*) AS orders
       FROM orders
      WHERE tenant_id = $1 AND deleted_at IS NULL AND created_at BETWEEN $2 AND $3
      GROUP BY 1 ORDER BY 1`,
    [tenantId, from, to],
  );
  return rows;
}

/** Top-selling dishes by quantity + revenue. */
export async function popularDishes({ tenantId, from, to, limit = 10 }) {
  const { rows } = await query(
    `SELECT oi.name_snapshot AS name,
            sum(oi.quantity)::int AS qty,
            coalesce(sum(oi.line_total), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.tenant_id = $1 AND o.deleted_at IS NULL
        AND o.status <> 'CANCELLED' AND o.created_at BETWEEN $2 AND $3
      GROUP BY oi.name_snapshot
      ORDER BY qty DESC LIMIT $4`,
    [tenantId, from, to, limit],
  );
  return rows;
}

/** Average preparation time (accepted → ready) in minutes. */
export async function avgPrepTime({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT coalesce(avg(extract(epoch FROM (ready_at - accepted_at)) / 60), 0) AS avg_prep_mins
       FROM orders
      WHERE tenant_id = $1 AND deleted_at IS NULL
        AND accepted_at IS NOT NULL AND ready_at IS NOT NULL
        AND created_at BETWEEN $2 AND $3`,
    [tenantId, from, to],
  );
  return Number(rows[0].avg_prep_mins);
}

/** Waiter performance: orders served + revenue handled. */
export async function waiterPerformance({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT u.id, u.full_name AS name,
            count(o.*) FILTER (WHERE o.served_at IS NOT NULL) AS served,
            coalesce(sum(o.total_amount) FILTER (WHERE o.payment_status = 'PAID'), 0) AS revenue
       FROM users u
       LEFT JOIN orders o ON o.waiter_id = u.id AND o.deleted_at IS NULL
            AND o.created_at BETWEEN $2 AND $3
      WHERE u.tenant_id = $1 AND u.role = 'WAITER' AND u.deleted_at IS NULL
      GROUP BY u.id, u.full_name ORDER BY served DESC`,
    [tenantId, from, to],
  );
  return rows;
}

/** Returning vs new customers within the window. */
export async function customerBreakdown({ tenantId }) {
  const { rows } = await query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE visits_count > 1)::int AS returning
       FROM customers WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows[0];
}

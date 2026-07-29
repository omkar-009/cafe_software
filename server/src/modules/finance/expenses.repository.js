import { query } from '../../config/database.js';
import { buildUpdate, mapKeysToSnake } from '../../shared/sqlUpdate.js';

const COLS = `id, tenant_id, category, title, amount, vendor, payment_method,
  expense_date, note, attachment_url, is_recurring, created_at, updated_at`;

function buildWhere({ tenantId, category, search, from, to }) {
  const where = ['tenant_id = $1', 'deleted_at IS NULL'];
  const params = [tenantId];
  const add = (frag, val) => { params.push(val); where.push(frag.replace('?', `$${params.length}`)); };
  if (category) add('category = ?', category);
  if (from) add('expense_date >= ?', from);
  if (to) add('expense_date <= ?', to);
  if (search) {
    params.push(`%${search}%`);
    where.push(`(title ILIKE $${params.length} OR vendor ILIKE $${params.length} OR note ILIKE $${params.length})`);
  }
  return { whereSql: where.join(' AND '), params };
}

export async function list(filters, { limit, offset }) {
  const { whereSql, params } = buildWhere(filters);
  const total = await query(`SELECT count(*)::int AS total FROM expenses WHERE ${whereSql}`, params);
  const sum = await query(`SELECT COALESCE(sum(amount),0)::float AS total_amount FROM expenses WHERE ${whereSql}`, params);
  const { rows } = await query(
    `SELECT ${COLS} FROM expenses WHERE ${whereSql}
     ORDER BY expense_date DESC, created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows, total: total.rows[0].total, totalAmount: sum.rows[0].total_amount };
}

export async function findById({ tenantId, id }) {
  const { rows } = await query(
    `SELECT ${COLS} FROM expenses WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function create({ tenantId, data, actorId }) {
  const d = mapKeysToSnake(data);
  const { rows } = await query(
    `INSERT INTO expenses
       (tenant_id, category, title, amount, vendor, payment_method, expense_date, note,
        attachment_url, is_recurring, created_by)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,'CASH'),COALESCE($7,CURRENT_DATE),$8,$9,COALESCE($10,false),$11)
     RETURNING ${COLS}`,
    [
      tenantId, data.category, data.title, data.amount, d.vendor || null,
      data.paymentMethod, data.expenseDate || null, d.note || null,
      d.attachment_url || null, data.isRecurring, actorId,
    ],
  );
  return rows[0];
}

const UPDATABLE = ['category', 'title', 'amount', 'vendor', 'payment_method', 'expense_date',
  'note', 'attachment_url', 'is_recurring'];

export async function update({ tenantId, id, data, actorId }) {
  const { setSql, params, nextIndex, hasChanges } = buildUpdate(mapKeysToSnake(data), UPDATABLE, 1);
  if (!hasChanges) return findById({ tenantId, id });
  const { rows } = await query(
    `UPDATE expenses SET ${setSql}, updated_by = $${nextIndex}
     WHERE id = $${nextIndex + 1} AND tenant_id = $${nextIndex + 2} AND deleted_at IS NULL
     RETURNING ${COLS}`,
    [...params, actorId, id, tenantId],
  );
  return rows[0] || null;
}

export async function softDelete({ tenantId, id, actorId }) {
  const { rowCount } = await query(
    `UPDATE expenses SET deleted_at = now(), deleted_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [actorId, id, tenantId],
  );
  return rowCount > 0;
}

/** Totals grouped by category for a date range (drives the breakdown chart). */
export async function summaryByCategory({ tenantId, from, to }) {
  const { whereSql, params } = buildWhere({ tenantId, from, to });
  const { rows } = await query(
    `SELECT category, count(*)::int AS count, COALESCE(sum(amount),0)::float AS total
       FROM expenses WHERE ${whereSql}
      GROUP BY category ORDER BY total DESC`,
    params,
  );
  return rows;
}

/** Single scalar: total expenses in a date range (used by P&L). */
export async function totalForRange({ tenantId, from, to, q = query }) {
  const { whereSql, params } = buildWhere({ tenantId, from, to });
  const { rows } = await q(
    `SELECT COALESCE(sum(amount),0)::float AS total FROM expenses WHERE ${whereSql}`,
    params,
  );
  return rows[0].total;
}

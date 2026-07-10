import { query } from '../../config/database.js';
import { buildUpdate, mapKeysToSnake } from '../../shared/sqlUpdate.js';

const COLS = `id, tenant_id, code, description, type, value, min_order_amount, max_discount,
  usage_limit, used_count, per_customer_limit, starts_at, expires_at, is_active,
  created_at, updated_at`;

export async function list({ tenantId, activeOnly }) {
  const where = ['tenant_id = $1', 'deleted_at IS NULL'];
  if (activeOnly) where.push('is_active = true');
  const { rows } = await query(
    `SELECT ${COLS} FROM coupons WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
    [tenantId],
  );
  return rows;
}

export async function findById({ tenantId, id }) {
  const { rows } = await query(
    `SELECT ${COLS} FROM coupons WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function findByCode({ tenantId, code, q = query }) {
  const { rows } = await q(
    `SELECT ${COLS} FROM coupons WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [tenantId, code],
  );
  return rows[0] || null;
}

export async function create({ tenantId, data, actorId }) {
  const d = mapKeysToSnake(data);
  const { rows } = await query(
    `INSERT INTO coupons
       (tenant_id, code, description, type, value, min_order_amount, max_discount,
        usage_limit, per_customer_limit, starts_at, expires_at, is_active, created_by)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,0),$7,$8,$9,$10,$11,COALESCE($12,true),$13)
     RETURNING ${COLS}`,
    [
      tenantId, data.code, d.description || null, data.type, data.value,
      d.min_order_amount, d.max_discount || null, d.usage_limit || null,
      d.per_customer_limit || null, d.starts_at || null, d.expires_at || null,
      data.isActive, actorId,
    ],
  );
  return rows[0];
}

const UPDATABLE = ['description', 'type', 'value', 'min_order_amount', 'max_discount',
  'usage_limit', 'per_customer_limit', 'starts_at', 'expires_at', 'is_active'];

export async function update({ tenantId, id, data, actorId }) {
  const { setSql, params, nextIndex, hasChanges } = buildUpdate(mapKeysToSnake(data), UPDATABLE, 1);
  if (!hasChanges) return findById({ tenantId, id });
  const { rows } = await query(
    `UPDATE coupons SET ${setSql}, updated_by = $${nextIndex}
     WHERE id = $${nextIndex + 1} AND tenant_id = $${nextIndex + 2} AND deleted_at IS NULL
     RETURNING ${COLS}`,
    [...params, actorId, id, tenantId],
  );
  return rows[0] || null;
}

export async function incrementUsage({ id, q = query }) {
  await q('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [id]);
}

export async function softDelete({ tenantId, id, actorId }) {
  const { rowCount } = await query(
    `UPDATE coupons SET deleted_at = now(), deleted_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [actorId, id, tenantId],
  );
  return rowCount > 0;
}

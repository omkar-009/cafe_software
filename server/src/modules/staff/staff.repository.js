import { query } from '../../config/database.js';
import { buildUpdate, mapKeysToSnake } from '../../shared/sqlUpdate.js';

const COLS = `id, tenant_id, role, full_name, email, phone, avatar_url,
  is_active, permissions, last_login_at, created_at, updated_at`;

export async function list({ tenantId, role, search, limit, offset }) {
  const where = ['tenant_id = $1', 'deleted_at IS NULL', "role <> 'CUSTOMER'"];
  const params = [tenantId];
  if (role) {
    params.push(role);
    where.push(`role = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  const whereSql = where.join(' AND ');
  const total = await query(`SELECT count(*)::int AS total FROM users WHERE ${whereSql}`, params);
  const { rows } = await query(
    `SELECT ${COLS} FROM users WHERE ${whereSql}
     ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows, total: total.rows[0].total };
}

export async function findById({ tenantId, id }) {
  const { rows } = await query(
    `SELECT ${COLS} FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function emailExists({ tenantId, email, excludeId = null }) {
  const { rows } = await query(
    `SELECT 1 FROM users
      WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL AND ($3::uuid IS NULL OR id <> $3)`,
    [tenantId, email, excludeId],
  );
  return rows.length > 0;
}

export async function create({ tenantId, role, fullName, email, phone, passwordHash, permissions, actorId }) {
  const { rows } = await query(
    `INSERT INTO users (tenant_id, role, full_name, email, phone, password_hash, permissions, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLS}`,
    [tenantId, role, fullName, email, phone || null, passwordHash, permissions ? JSON.stringify(permissions) : null, actorId],
  );
  return rows[0];
}

const UPDATABLE = ['full_name', 'phone', 'role', 'avatar_url', 'is_active', 'permissions'];

export async function update({ tenantId, id, data, actorId }) {
  const payload = mapKeysToSnake(data);
  if (payload.permissions !== undefined) payload.permissions = JSON.stringify(payload.permissions);
  const { setSql, params, nextIndex, hasChanges } = buildUpdate(payload, UPDATABLE, 1);
  if (!hasChanges) return findById({ tenantId, id });
  const { rows } = await query(
    `UPDATE users SET ${setSql}, updated_by = $${nextIndex}
     WHERE id = $${nextIndex + 1} AND tenant_id = $${nextIndex + 2} AND deleted_at IS NULL
     RETURNING ${COLS}`,
    [...params, actorId, id, tenantId],
  );
  return rows[0] || null;
}

export async function updatePassword({ tenantId, id, passwordHash, actorId }) {
  await query(
    `UPDATE users SET password_hash = $1, updated_by = $2
     WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL`,
    [passwordHash, actorId, id, tenantId],
  );
}

export async function softDelete({ tenantId, id, actorId }) {
  const { rowCount } = await query(
    `UPDATE users SET deleted_at = now(), deleted_by = $1, is_active = false
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [actorId, id, tenantId],
  );
  return rowCount > 0;
}

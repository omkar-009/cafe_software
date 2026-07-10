import { query } from '../../config/database.js';
import { buildUpdate, mapKeysToSnake } from '../../shared/sqlUpdate.js';

const PUBLIC_COLUMNS = `
  id, slug, name, legal_name, email, phone, status,
  logo_url, cover_url, brand_color, menu_header, menu_footer,
  currency, timezone, address, gst_number, settings,
  created_at, updated_at`;

export async function findById(id) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM tenants WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return rows[0] || null;
}

export async function findBySlug(slug) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM tenants WHERE slug = $1 AND deleted_at IS NULL`,
    [slug],
  );
  return rows[0] || null;
}

const UPDATABLE = [
  'name', 'legal_name', 'email', 'phone', 'logo_url', 'cover_url', 'brand_color',
  'menu_header', 'menu_footer', 'currency', 'timezone', 'address', 'gst_number', 'settings',
];

export async function update(id, data, actorId) {
  const payload = mapKeysToSnake(data);
  if (payload.address !== undefined) payload.address = JSON.stringify(payload.address);
  if (payload.settings !== undefined) payload.settings = JSON.stringify(payload.settings);

  const { setSql, params, nextIndex, hasChanges } = buildUpdate(payload, UPDATABLE, 1);
  if (!hasChanges) return findById(id);

  const { rows } = await query(
    `UPDATE tenants SET ${setSql}, updated_by = $${nextIndex}
     WHERE id = $${nextIndex + 1} AND deleted_at IS NULL
     RETURNING ${PUBLIC_COLUMNS}`,
    [...params, actorId, id],
  );
  return rows[0] || null;
}

export async function setStatus(id, status, actorId) {
  const { rows } = await query(
    `UPDATE tenants SET status = $1, updated_by = $2
     WHERE id = $3 AND deleted_at IS NULL RETURNING ${PUBLIC_COLUMNS}`,
    [status, actorId, id],
  );
  return rows[0] || null;
}

export async function list({ status, search, limit, offset }) {
  const where = ['t.deleted_at IS NULL'];
  const params = [];
  if (status) {
    params.push(status);
    where.push(`t.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(t.name ILIKE $${params.length} OR t.slug ILIKE $${params.length})`);
  }
  const whereSql = where.join(' AND ');

  const totalRes = await query(`SELECT count(*)::int AS total FROM tenants t WHERE ${whereSql}`, params);
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS},
       (SELECT count(*) FROM users u WHERE u.tenant_id = t.id AND u.deleted_at IS NULL) AS staff_count
     FROM tenants t
     WHERE ${whereSql}
     ORDER BY t.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows, total: totalRes.rows[0].total };
}

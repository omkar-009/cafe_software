import { query } from '../../config/database.js';
import { buildUpdate, mapKeysToSnake } from '../../shared/sqlUpdate.js';

const COLS = `id, tenant_id, name, description, image_url, sort_order, is_active, created_at, updated_at`;

export async function list({ tenantId, includeInactive = false }) {
  const { rows } = await query(
    `SELECT c.id, c.tenant_id, c.name, c.description, c.image_url, c.sort_order,
            c.is_active, c.created_at, c.updated_at,
       (SELECT count(*) FROM menu_items m WHERE m.category_id = c.id AND m.deleted_at IS NULL) AS item_count
     FROM categories c
     WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
       AND ($2 = true OR c.is_active = true)
     ORDER BY c.sort_order ASC, c.name ASC`,
    [tenantId, includeInactive],
  );
  return rows;
}

export async function findById({ tenantId, id }) {
  const { rows } = await query(
    `SELECT ${COLS} FROM categories WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function create({ tenantId, name, description, imageUrl, sortOrder, actorId }) {
  const { rows } = await query(
    `INSERT INTO categories (tenant_id, name, description, image_url, sort_order, created_by)
     VALUES ($1,$2,$3,$4,COALESCE($5,0),$6) RETURNING ${COLS}`,
    [tenantId, name, description || null, imageUrl || null, sortOrder, actorId],
  );
  return rows[0];
}

const UPDATABLE = ['name', 'description', 'image_url', 'sort_order', 'is_active'];

export async function update({ tenantId, id, data, actorId }) {
  const { setSql, params, nextIndex, hasChanges } = buildUpdate(mapKeysToSnake(data), UPDATABLE, 1);
  if (!hasChanges) return findById({ tenantId, id });
  const { rows } = await query(
    `UPDATE categories SET ${setSql}, updated_by = $${nextIndex}
     WHERE id = $${nextIndex + 1} AND tenant_id = $${nextIndex + 2} AND deleted_at IS NULL
     RETURNING ${COLS}`,
    [...params, actorId, id, tenantId],
  );
  return rows[0] || null;
}

export async function softDelete({ tenantId, id, actorId }) {
  const { rowCount } = await query(
    `UPDATE categories SET deleted_at = now(), deleted_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [actorId, id, tenantId],
  );
  return rowCount > 0;
}

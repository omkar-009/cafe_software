import { query } from '../../config/database.js';
import { buildUpdate, mapKeysToSnake } from '../../shared/sqlUpdate.js';

/* ── Floors ── */
const FLOOR_COLS = 'id, tenant_id, name, sort_order, is_active, created_at, updated_at';

export async function listFloors({ tenantId }) {
  const { rows } = await query(
    `SELECT ${FLOOR_COLS} FROM floors WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY sort_order, name`,
    [tenantId],
  );
  return rows;
}

export async function createFloor({ tenantId, name, sortOrder, actorId }) {
  const { rows } = await query(
    `INSERT INTO floors (tenant_id, name, sort_order, created_by)
     VALUES ($1,$2,COALESCE($3,0),$4) RETURNING ${FLOOR_COLS}`,
    [tenantId, name, sortOrder, actorId],
  );
  return rows[0];
}

export async function updateFloor({ tenantId, id, data, actorId }) {
  const { setSql, params, nextIndex, hasChanges } = buildUpdate(
    mapKeysToSnake(data), ['name', 'sort_order', 'is_active'], 1,
  );
  if (!hasChanges) return findFloor({ tenantId, id });
  const { rows } = await query(
    `UPDATE floors SET ${setSql}, updated_by = $${nextIndex}
     WHERE id = $${nextIndex + 1} AND tenant_id = $${nextIndex + 2} AND deleted_at IS NULL
     RETURNING ${FLOOR_COLS}`,
    [...params, actorId, id, tenantId],
  );
  return rows[0] || null;
}

export async function findFloor({ tenantId, id }) {
  const { rows } = await query(
    `SELECT ${FLOOR_COLS} FROM floors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return rows[0] || null;
}

export async function deleteFloor({ tenantId, id, actorId }) {
  const { rowCount } = await query(
    `UPDATE floors SET deleted_at = now(), deleted_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [actorId, id, tenantId],
  );
  return rowCount > 0;
}

/* ── Tables ── */
const TABLE_COLS = `id, tenant_id, floor_id, table_number, label, seat_capacity, status,
  qr_token, qr_version, qr_image_url, created_at, updated_at`;

export async function listTables({ tenantId, floorId, status }) {
  const where = ['t.tenant_id = $1', 't.deleted_at IS NULL'];
  const params = [tenantId];
  if (floorId) {
    params.push(floorId);
    where.push(`t.floor_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`t.status = $${params.length}`);
  }
  const { rows } = await query(
    `SELECT t.id, t.tenant_id, t.floor_id, f.name AS floor_name, t.table_number, t.label,
            t.seat_capacity, t.status, t.qr_token, t.qr_version, t.qr_image_url, t.created_at
       FROM restaurant_tables t
       LEFT JOIN floors f ON f.id = t.floor_id
      WHERE ${where.join(' AND ')}
      ORDER BY f.sort_order NULLS FIRST, t.table_number`,
    params,
  );
  return rows;
}

export async function findTable({ tenantId, id }) {
  const { rows } = await query(
    `SELECT ${TABLE_COLS} FROM restaurant_tables WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return rows[0] || null;
}

/** Public: resolve a table by its rotating QR token (tenant-agnostic lookup). */
export async function findByQrToken(qrToken) {
  const { rows } = await query(
    `SELECT t.id, t.tenant_id, t.floor_id, t.table_number, t.label, t.seat_capacity,
            t.status, t.qr_token, t.qr_version
       FROM restaurant_tables t
      WHERE t.qr_token = $1 AND t.deleted_at IS NULL`,
    [qrToken],
  );
  return rows[0] || null;
}

export async function createTable({ tenantId, floorId, tableNumber, label, seatCapacity, actorId }) {
  const { rows } = await query(
    `INSERT INTO restaurant_tables (tenant_id, floor_id, table_number, label, seat_capacity, created_by)
     VALUES ($1,$2,$3,$4,COALESCE($5,4),$6) RETURNING ${TABLE_COLS}`,
    [tenantId, floorId || null, tableNumber, label || null, seatCapacity, actorId],
  );
  return rows[0];
}

export async function updateTable({ tenantId, id, data, actorId }) {
  const { setSql, params, nextIndex, hasChanges } = buildUpdate(
    mapKeysToSnake(data), ['floor_id', 'table_number', 'label', 'seat_capacity', 'status', 'qr_image_url'], 1,
  );
  if (!hasChanges) return findTable({ tenantId, id });
  const { rows } = await query(
    `UPDATE restaurant_tables SET ${setSql}, updated_by = $${nextIndex}
     WHERE id = $${nextIndex + 1} AND tenant_id = $${nextIndex + 2} AND deleted_at IS NULL
     RETURNING ${TABLE_COLS}`,
    [...params, actorId, id, tenantId],
  );
  return rows[0] || null;
}

/** Rotate the QR token (invalidates every previously printed QR for this table). */
export async function rotateQr({ tenantId, id, actorId }) {
  const { rows } = await query(
    `UPDATE restaurant_tables
        SET qr_token = encode(gen_random_bytes(16),'hex'),
            qr_version = qr_version + 1,
            qr_image_url = NULL,
            updated_by = $1
      WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
      RETURNING ${TABLE_COLS}`,
    [actorId, id, tenantId],
  );
  return rows[0] || null;
}

export async function deleteTable({ tenantId, id, actorId }) {
  const { rowCount } = await query(
    `UPDATE restaurant_tables SET deleted_at = now(), deleted_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [actorId, id, tenantId],
  );
  return rowCount > 0;
}

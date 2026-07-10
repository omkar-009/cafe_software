/**
 * Notification service — persists a notification row and pushes it in real time
 * to the right audience (a role room or a specific user) via Socket.IO.
 */
import { query } from '../../config/database.js';
import logger from '../../config/logger.js';
import { emitToRole, emitToUser, emitToTenant } from '../../realtime/socket.js';

/**
 * @param {object} p
 * @param {string} p.tenantId
 * @param {string} [p.targetRole]  broadcast to a role (KITCHEN/WAITER/RESTAURANT_ADMIN)
 * @param {string} [p.userId]      or target a single user
 * @param {string} p.type
 * @param {string} p.title
 * @param {string} [p.body]
 * @param {string} [p.link]
 * @param {object} [p.data]
 */
export async function notify({ tenantId, targetRole = null, userId = null, type, title, body = null, link = null, data = {} }) {
  try {
    const { rows } = await query(
      `INSERT INTO notifications (tenant_id, user_id, target_role, type, title, body, link, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantId, userId, targetRole, type, title, body, link, JSON.stringify(data)],
    );
    const notification = rows[0];
    if (userId) emitToUser(userId, 'notification:new', notification);
    else if (targetRole) emitToRole(tenantId, targetRole, 'notification:new', notification);
    else emitToTenant(tenantId, 'notification:new', notification);
    return notification;
  } catch (err) {
    logger.error({ err, type }, 'Failed to create notification');
    return null;
  }
}

export async function list({ tenantId, userId, role, unreadOnly, limit, offset }) {
  const where = ['tenant_id = $1', '(user_id = $2 OR (user_id IS NULL AND target_role = $3))'];
  const params = [tenantId, userId, role];
  if (unreadOnly) where.push('is_read = false');
  const whereSql = where.join(' AND ');
  const { rows } = await query(
    `SELECT * FROM notifications WHERE ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  const unread = await query(
    `SELECT count(*)::int AS c FROM notifications WHERE ${whereSql} AND is_read = false`,
    params,
  );
  return { rows, unread: unread.rows[0].c };
}

export async function markRead({ tenantId, userId, role, id }) {
  await query(
    `UPDATE notifications SET is_read = true, read_at = now()
      WHERE id = $1 AND tenant_id = $2 AND (user_id = $3 OR (user_id IS NULL AND target_role = $4))`,
    [id, tenantId, userId, role],
  );
}

export async function markAllRead({ tenantId, userId, role }) {
  await query(
    `UPDATE notifications SET is_read = true, read_at = now()
      WHERE tenant_id = $1 AND is_read = false AND (user_id = $2 OR (user_id IS NULL AND target_role = $3))`,
    [tenantId, userId, role],
  );
}

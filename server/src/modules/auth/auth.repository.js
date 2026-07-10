/**
 * Auth data-access layer. All queries are parameterized and tenant-aware.
 */
import { query } from '../../config/database.js';

export async function findUserByEmail({ email, tenantId = null }) {
  const { rows } = await query(
    `SELECT u.*, t.slug AS tenant_slug, t.name AS tenant_name, t.status AS tenant_status
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = $1
        AND ($2::uuid IS NULL AND u.tenant_id IS NULL OR u.tenant_id = $2)
        AND u.deleted_at IS NULL
      LIMIT 1`,
    [email, tenantId],
  );
  return rows[0] || null;
}

export async function findUserByEmailInTenantSlug({ email, tenantSlug }) {
  const { rows } = await query(
    `SELECT u.*, t.slug AS tenant_slug, t.name AS tenant_name, t.status AS tenant_status
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = $1 AND t.slug = $2 AND u.deleted_at IS NULL
      LIMIT 1`,
    [email, tenantSlug],
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query(
    `SELECT u.*, t.slug AS tenant_slug, t.name AS tenant_name, t.status AS tenant_status
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = $1 AND u.deleted_at IS NULL
      LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

export async function updateLastLogin(id) {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

export async function saveRefreshToken({
  userId,
  tenantId,
  tokenHash,
  familyId,
  expiresAt,
  userAgent,
  ip,
  q = query,
}) {
  const { rows } = await q(
    `INSERT INTO refresh_tokens
       (user_id, tenant_id, token_hash, family_id, expires_at, user_agent, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [userId, tenantId, tokenHash, familyId, expiresAt, userAgent, ip],
  );
  return rows[0];
}

export async function findRefreshToken(tokenHash) {
  const { rows } = await query(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1',
    [tokenHash],
  );
  return rows[0] || null;
}

export async function revokeRefreshToken(id, replacedBy = null, q = query) {
  await q(
    'UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1',
    [id, replacedBy],
  );
}

export async function revokeTokenFamily(familyId) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
    [familyId],
  );
}

export async function revokeAllUserTokens(userId) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
}

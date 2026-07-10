/**
 * Auth business logic: tenant self-serve signup, login, token refresh with
 * rotation + reuse detection, logout, and current-user resolution.
 */
import { randomUUID } from 'node:crypto';
import { withTransaction } from '../../config/database.js';
import ApiError from '../../shared/ApiError.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../shared/security.js';
import ms from '../../shared/ms.js';
import env from '../../config/env.js';
import { ROLES, ROLE_PERMISSIONS, TENANT_STATUS } from '../../shared/constants.js';
import { recordAudit } from '../audit/audit.service.js';
import * as repo from './auth.repository.js';

function toPublicUser(u) {
  return {
    id: u.id,
    tenantId: u.tenant_id,
    tenantSlug: u.tenant_slug || null,
    tenantName: u.tenant_name || null,
    role: u.role,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    avatarUrl: u.avatar_url,
    permissions: u.permissions?.length ? u.permissions : ROLE_PERMISSIONS[u.role] || [],
    lastLoginAt: u.last_login_at,
  };
}

function issueAccessToken(user) {
  return signAccessToken({
    sub: user.id,
    tenantId: user.tenant_id ?? null,
    role: user.role,
    name: user.full_name,
    permissions: user.permissions?.length ? user.permissions : undefined,
  });
}

/**
 * Register a new restaurant (tenant) together with its first Restaurant Admin.
 * Runs in a single transaction so a partial signup can never persist.
 */
export async function registerTenant({ restaurantName, slug, adminName, email, password, phone }, client) {
  const result = await withTransaction(async (q) => {
    const existingSlug = await q('SELECT 1 FROM tenants WHERE slug = $1', [slug]);
    if (existingSlug.rowCount) throw ApiError.conflict('That restaurant handle is already taken');

    const tenantRes = await q(
      `INSERT INTO tenants (slug, name, email, phone, status)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [slug, restaurantName, email, phone || null, TENANT_STATUS.TRIAL],
    );
    const tenant = tenantRes.rows[0];

    const passwordHash = await hashPassword(password);
    const adminRes = await q(
      `INSERT INTO users (tenant_id, role, full_name, email, phone, password_hash, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$1) RETURNING *`,
      [tenant.id, ROLES.RESTAURANT_ADMIN, adminName, email, phone || null, passwordHash],
    );
    const admin = adminRes.rows[0];

    // Attach the free trial subscription if a FREE/STARTER plan exists.
    await q(
      `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
       SELECT $1, id, 'TRIAL', now() + interval '14 days'
         FROM subscription_plans WHERE code = 'FREE' LIMIT 1`,
      [tenant.id],
    );

    await recordAudit({
      tenantId: tenant.id,
      module: 'TENANT',
      action: 'CREATE',
      recordId: tenant.id,
      description: `Restaurant "${restaurantName}" registered`,
      actor: { id: admin.id, role: admin.role, name: admin.full_name },
      client,
      q,
    });

    return { tenant, admin };
  });

  const tokens = await issueTokenPair(result.admin, client);
  return { user: toPublicUser({ ...result.admin, tenant_slug: result.tenant.slug, tenant_name: result.tenant.name }), ...tokens };
}

/** Password login. `tenantSlug` selects the restaurant; omit for SUPER_ADMIN. */
export async function login({ email, password, tenantSlug }, client) {
  const user = tenantSlug
    ? await repo.findUserByEmailInTenantSlug({ email, tenantSlug })
    : await repo.findUserByEmail({ email });

  // Uniform failure message + always run a hash compare to reduce user enumeration.
  if (!user || !user.password_hash) {
    await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidin');
    throw ApiError.unauthorized('Invalid email or password');
  }

  const okPass = await verifyPassword(password, user.password_hash);
  if (!okPass) throw ApiError.unauthorized('Invalid email or password');
  if (!user.is_active) throw ApiError.forbidden('This account is disabled');
  if (user.tenant_id && user.tenant_status !== TENANT_STATUS.ACTIVE && user.tenant_status !== TENANT_STATUS.TRIAL) {
    throw ApiError.forbidden('This restaurant is currently suspended');
  }

  await repo.updateLastLogin(user.id);
  const tokens = await issueTokenPair(user, client);

  await recordAudit({
    tenantId: user.tenant_id,
    module: 'AUTH',
    action: 'LOGIN',
    recordId: user.id,
    description: `${user.full_name} signed in`,
    actor: { id: user.id, role: user.role, name: user.full_name },
    client,
  });

  return { user: toPublicUser(user), ...tokens };
}

/** Issue an access + refresh token pair and persist the refresh hash. */
async function issueTokenPair(user, client, familyId = randomUUID()) {
  const accessToken = issueAccessToken(user);
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + ms(env.JWT_REFRESH_TTL));
  await repo.saveRefreshToken({
    userId: user.id,
    tenantId: user.tenant_id ?? null,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt,
    userAgent: client?.userAgent,
    ip: client?.ip,
  });
  return { accessToken, refreshToken };
}

/**
 * Rotate a refresh token. Detects reuse of an already-rotated token and, if so,
 * revokes the whole family (stolen-token defense).
 */
export async function refresh(rawRefreshToken, client) {
  if (!rawRefreshToken) throw ApiError.unauthorized('Missing refresh token');
  const stored = await repo.findRefreshToken(hashToken(rawRefreshToken));
  if (!stored) throw ApiError.unauthorized('Invalid session');

  if (stored.revoked_at) {
    // Token reuse → compromise. Nuke the family.
    await repo.revokeTokenFamily(stored.family_id);
    throw ApiError.unauthorized('Session revoked, please sign in again');
  }
  if (new Date(stored.expires_at) < new Date()) {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  const user = await repo.findUserById(stored.user_id);
  if (!user || !user.is_active) throw ApiError.unauthorized('Account unavailable');

  const rotated = await withTransaction(async (q) => {
    const accessToken = issueAccessToken(user);
    const newRefresh = generateRefreshToken();
    const expiresAt = new Date(Date.now() + ms(env.JWT_REFRESH_TTL));
    const inserted = await repo.saveRefreshToken({
      userId: user.id,
      tenantId: user.tenant_id ?? null,
      tokenHash: hashToken(newRefresh),
      familyId: stored.family_id,
      expiresAt,
      userAgent: client?.userAgent,
      ip: client?.ip,
      q,
    });
    await repo.revokeRefreshToken(stored.id, inserted.id, q);
    return { accessToken, refreshToken: newRefresh };
  });

  return { user: toPublicUser(user), ...rotated };
}

export async function logout(rawRefreshToken, req) {
  if (rawRefreshToken) {
    const stored = await repo.findRefreshToken(hashToken(rawRefreshToken));
    if (stored && !stored.revoked_at) await repo.revokeRefreshToken(stored.id);
  }
  if (req?.user) {
    await recordAudit({
      tenantId: req.user.tenantId,
      module: 'AUTH',
      action: 'LOGOUT',
      recordId: req.user.id,
      description: `${req.user.fullName} signed out`,
      actor: { id: req.user.id, role: req.user.role, name: req.user.fullName },
      client: req.clientCtx,
    });
  }
}

export async function me(userId) {
  const user = await repo.findUserById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return toPublicUser(user);
}

/**
 * Authentication middleware. Resolves the current user from the access-token
 * cookie (falls back to `Authorization: Bearer` for API clients / KDS screens).
 *
 * On success attaches:
 *   req.user     → { id, tenantId, role, fullName, permissions }
 *   req.tenantId → the caller's tenant (NULL for SUPER_ADMIN)
 */
import ApiError from '../shared/ApiError.js';
import { verifyAccessToken } from '../shared/security.js';
import { ACCESS_COOKIE } from '../shared/cookies.js';
import { ROLE_PERMISSIONS } from '../shared/constants.js';

function extractToken(req) {
  if (req.cookies?.[ACCESS_COOKIE]) return req.cookies[ACCESS_COOKIE];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function authenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized('Authentication required'));

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId ?? null,
      role: payload.role,
      fullName: payload.name,
      permissions: payload.permissions?.length
        ? payload.permissions
        : ROLE_PERMISSIONS[payload.role] || [],
    };
    req.tenantId = req.user.tenantId;
    return next();
  } catch {
    return next(ApiError.unauthorized('Session expired or invalid, please sign in again'));
  }
}

/** Optional auth: attaches req.user if a valid token exists, never rejects. */
export function optionalAuthenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId ?? null,
      role: payload.role,
      fullName: payload.name,
      permissions: payload.permissions?.length
        ? payload.permissions
        : ROLE_PERMISSIONS[payload.role] || [],
    };
    req.tenantId = req.user.tenantId;
  } catch {
    /* ignore — treat as anonymous */
  }
  return next();
}

/**
 * Authorization middleware.
 *
 *   requireRole(...roles)          → gate by role
 *   requirePermission(...perms)    → gate by fine-grained permission (ANY match)
 *   requireAllPermissions(...perms)→ require every listed permission
 *
 * Must run after `authenticate`.
 */
import ApiError from '../shared/ApiError.js';
import { ROLES } from '../shared/constants.js';

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Your role cannot access this resource'));
    }
    return next();
  };
}

export function requirePermission(...perms) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === ROLES.SUPER_ADMIN) return next(); // platform owner override
    const granted = new Set(req.user.permissions || []);
    if (perms.some((p) => granted.has(p))) return next();
    return next(ApiError.forbidden('Missing required permission'));
  };
}

export function requireAllPermissions(...perms) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === ROLES.SUPER_ADMIN) return next();
    const granted = new Set(req.user.permissions || []);
    if (perms.every((p) => granted.has(p))) return next();
    return next(ApiError.forbidden('Missing required permission'));
  };
}

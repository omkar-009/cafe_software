/**
 * Tenant isolation guard.
 *
 * The tenant is derived from the AUTHENTICATED user's token — never from client
 * input — so a request can only ever touch its own tenant's data. Repositories
 * additionally receive `tenantId` and always include it in WHERE clauses,
 * giving defense-in-depth.
 *
 *   requireTenant   → route needs a concrete tenant (rejects platform-only users)
 */
import ApiError from '../shared/ApiError.js';
import { ROLES } from '../shared/constants.js';

export function requireTenant(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());

  if (req.user.role === ROLES.SUPER_ADMIN) {
    // Super admin may operate on a specific tenant only via explicit, audited
    // platform routes that set an X-Tenant-Id after an ownership check.
    const impersonated = req.headers['x-tenant-id'];
    if (impersonated) {
      req.tenantId = impersonated;
      req.isPlatformImpersonation = true;
      return next();
    }
    return next(ApiError.forbidden('This route is tenant-scoped'));
  }

  if (!req.user.tenantId) {
    return next(ApiError.forbidden('No tenant associated with this account'));
  }
  req.tenantId = req.user.tenantId;
  return next();
}

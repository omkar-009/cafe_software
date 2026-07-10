import ApiError from '../../shared/ApiError.js';
import { AUDIT_MODULE, TENANT_STATUS } from '../../shared/constants.js';
import { auditFromRequest } from '../audit/audit.service.js';
import * as repo from './tenants.repository.js';

export async function getMyTenant(tenantId) {
  const tenant = await repo.findById(tenantId);
  if (!tenant) throw ApiError.notFound('Restaurant not found');
  return tenant;
}

export async function updateMyTenant(req) {
  const before = await repo.findById(req.tenantId);
  if (!before) throw ApiError.notFound('Restaurant not found');

  const updated = await repo.update(req.tenantId, req.body, req.user.id);
  await auditFromRequest(req, {
    module: AUDIT_MODULE.SETTINGS,
    action: 'UPDATE',
    recordId: req.tenantId,
    description: 'Updated restaurant profile / branding',
    oldValues: pickBranding(before),
    newValues: pickBranding(updated),
  });
  return updated;
}

function pickBranding(t) {
  if (!t) return null;
  const { name, logo_url, cover_url, brand_color, menu_header, menu_footer, settings } = t;
  return { name, logo_url, cover_url, brand_color, menu_header, menu_footer, settings };
}

/* ── Platform (Super Admin) ── */

export async function listTenants({ status, search, limit, offset, page }) {
  const { rows, total } = await repo.list({ status, search, limit, offset });
  return { rows, total, page };
}

export async function getTenant(id) {
  const tenant = await repo.findById(id);
  if (!tenant) throw ApiError.notFound('Restaurant not found');
  return tenant;
}

export async function setTenantStatus(req, id, status) {
  if (!Object.values(TENANT_STATUS).includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  const before = await repo.findById(id);
  if (!before) throw ApiError.notFound('Restaurant not found');

  const updated = await repo.setStatus(id, status, req.user.id);
  await auditFromRequest(req, {
    tenantId: id,
    module: AUDIT_MODULE.TENANT,
    action: 'STATUS_CHANGE',
    recordId: id,
    description: `Restaurant status changed ${before.status} → ${status}`,
    oldValues: { status: before.status },
    newValues: { status },
  });
  return updated;
}

import ApiError from '../../shared/ApiError.js';
import { AUDIT_MODULE } from '../../shared/constants.js';
import { auditFromRequest } from '../audit/audit.service.js';
import * as repo from './categories.repository.js';

export async function listCategories({ tenantId, includeInactive }) {
  return repo.list({ tenantId, includeInactive });
}

export async function getCategory({ tenantId, id }) {
  const cat = await repo.findById({ tenantId, id });
  if (!cat) throw ApiError.notFound('Category not found');
  return cat;
}

export async function createCategory(req) {
  const cat = await repo.create({ tenantId: req.tenantId, ...req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.CATEGORY,
    action: 'CREATE',
    recordId: cat.id,
    description: `Created category "${cat.name}"`,
    newValues: { name: cat.name },
  });
  return cat;
}

export async function updateCategory(req) {
  const before = await repo.findById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Category not found');
  const updated = await repo.update({ tenantId: req.tenantId, id: req.params.id, data: req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.CATEGORY,
    action: 'UPDATE',
    recordId: updated.id,
    description: `Updated category "${updated.name}"`,
    oldValues: { name: before.name, is_active: before.is_active },
    newValues: { name: updated.name, is_active: updated.is_active },
  });
  return updated;
}

export async function deleteCategory(req) {
  const before = await repo.findById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Category not found');
  await repo.softDelete({ tenantId: req.tenantId, id: req.params.id, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.CATEGORY,
    action: 'DELETE',
    recordId: before.id,
    description: `Deleted category "${before.name}"`,
  });
}

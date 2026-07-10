import { withTransaction } from '../../config/database.js';
import ApiError from '../../shared/ApiError.js';
import { AUDIT_MODULE } from '../../shared/constants.js';
import { auditFromRequest } from '../audit/audit.service.js';
import * as repo from './menu.repository.js';

export async function listItems({ tenantId, ...filters }) {
  return repo.list({ tenantId, ...filters });
}

export async function getItem({ tenantId, id }) {
  const item = await repo.findFullById({ tenantId, id });
  if (!item) throw ApiError.notFound('Menu item not found');
  return item;
}

export async function createItem(req) {
  const { variants, images, addonGroups, ...base } = req.body;
  const item = await withTransaction(async (q) => {
    const created = await repo.insertItem({ tenantId: req.tenantId, data: base, actorId: req.user.id, q });
    await repo.replaceVariants({ tenantId: req.tenantId, itemId: created.id, variants, q });
    await repo.replaceImages({ tenantId: req.tenantId, itemId: created.id, images, q });
    await repo.replaceAddonGroups({ tenantId: req.tenantId, itemId: created.id, addonGroups, q });
    return created;
  });

  await auditFromRequest(req, {
    module: AUDIT_MODULE.MENU,
    action: 'CREATE',
    recordId: item.id,
    description: `Created menu item "${item.name}"`,
    newValues: { name: item.name, price: item.price },
  });
  return repo.findFullById({ tenantId: req.tenantId, id: item.id });
}

export async function updateItem(req) {
  const { variants, images, addonGroups, ...base } = req.body;
  const before = await repo.findBaseById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Menu item not found');

  await withTransaction(async (q) => {
    await repo.updateItem({ tenantId: req.tenantId, id: req.params.id, data: base, actorId: req.user.id, q });
    if (variants !== undefined) await repo.replaceVariants({ tenantId: req.tenantId, itemId: req.params.id, variants, q });
    if (images !== undefined) await repo.replaceImages({ tenantId: req.tenantId, itemId: req.params.id, images, q });
    if (addonGroups !== undefined) await repo.replaceAddonGroups({ tenantId: req.tenantId, itemId: req.params.id, addonGroups, q });
  });

  const updated = await repo.findFullById({ tenantId: req.tenantId, id: req.params.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.MENU,
    action: 'UPDATE',
    recordId: req.params.id,
    description: `Updated menu item "${updated.name}"`,
    oldValues: { name: before.name, price: before.price, is_available: before.is_available },
    newValues: { name: updated.name, price: updated.price, is_available: updated.is_available },
  });
  return updated;
}

/** Fast toggle for availability / out-of-stock (used from KDS & menu screens). */
export async function toggleItem(req) {
  const before = await repo.findBaseById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Menu item not found');
  const updated = await repo.updateItem({
    tenantId: req.tenantId,
    id: req.params.id,
    data: req.body,
    actorId: req.user.id,
  });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.MENU,
    action: 'TOGGLE',
    recordId: req.params.id,
    description: `Toggled availability for "${updated.name}"`,
    newValues: { is_available: updated.is_available, is_out_of_stock: updated.is_out_of_stock },
  });
  return updated;
}

export async function deleteItem(req) {
  const before = await repo.findBaseById({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Menu item not found');
  await repo.softDelete({ tenantId: req.tenantId, id: req.params.id, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.MENU,
    action: 'DELETE',
    recordId: before.id,
    description: `Deleted menu item "${before.name}"`,
  });
}

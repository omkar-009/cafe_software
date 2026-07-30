import ApiError from '../../shared/ApiError.js';
import { hashPassword } from '../../shared/security.js';
import { ROLES, AUDIT_MODULE } from '../../shared/constants.js';
import { auditFromRequest } from '../audit/audit.service.js';
import * as repo from './staff.repository.js';

// Roles a Restaurant Admin may assign inside their tenant.
const ASSIGNABLE_ROLES = [ROLES.RESTAURANT_ADMIN, ROLES.KITCHEN, ROLES.WAITER];

function assertAssignableRole(role) {
  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw ApiError.badRequest(`Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`);
  }
}

export async function listStaff(params) {
  return repo.list(params);
}

export async function getStaff({ tenantId, id }) {
  const staff = await repo.findById({ tenantId, id });
  if (!staff) throw ApiError.notFound('Staff member not found');
  return staff;
}

export async function createStaff(req) {
  const { role, fullName, email, phone, password, permissions, monthlySalary } = req.body;
  assertAssignableRole(role);

  if (await repo.emailExists({ tenantId: req.tenantId, email })) {
    throw ApiError.conflict('A staff member with this email already exists');
  }
  const passwordHash = await hashPassword(password);
  const staff = await repo.create({
    tenantId: req.tenantId,
    role,
    fullName,
    email,
    phone,
    passwordHash,
    permissions,
    monthlySalary,
    actorId: req.user.id,
  });

  await auditFromRequest(req, {
    module: AUDIT_MODULE.STAFF,
    action: 'CREATE',
    recordId: staff.id,
    description: `Added ${role} "${fullName}"`,
    newValues: { role, fullName, email },
  });
  return staff;
}

export async function updateStaff(req) {
  const { id } = req.params;
  const before = await repo.findById({ tenantId: req.tenantId, id });
  if (!before) throw ApiError.notFound('Staff member not found');
  if (req.body.role) assertAssignableRole(req.body.role);

  // Prevent an admin from disabling / demoting their own account by accident.
  if (id === req.user.id && (req.body.isActive === false || (req.body.role && req.body.role !== before.role))) {
    throw ApiError.badRequest('You cannot change your own role or disable your own account');
  }

  const updated = await repo.update({ tenantId: req.tenantId, id, data: req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.STAFF,
    action: 'UPDATE',
    recordId: id,
    description: `Updated staff "${updated.full_name}"`,
    oldValues: { role: before.role, is_active: before.is_active },
    newValues: { role: updated.role, is_active: updated.is_active },
  });
  return updated;
}

export async function resetPassword(req) {
  const { id } = req.params;
  const staff = await repo.findById({ tenantId: req.tenantId, id });
  if (!staff) throw ApiError.notFound('Staff member not found');
  const passwordHash = await hashPassword(req.body.password);
  await repo.updatePassword({ tenantId: req.tenantId, id, passwordHash, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.STAFF,
    action: 'PASSWORD_RESET',
    recordId: id,
    description: `Reset password for "${staff.full_name}"`,
  });
}

export async function deleteStaff(req) {
  const { id } = req.params;
  if (id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');
  const staff = await repo.findById({ tenantId: req.tenantId, id });
  if (!staff) throw ApiError.notFound('Staff member not found');
  await repo.softDelete({ tenantId: req.tenantId, id, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.STAFF,
    action: 'DELETE',
    recordId: id,
    description: `Removed staff "${staff.full_name}"`,
  });
}

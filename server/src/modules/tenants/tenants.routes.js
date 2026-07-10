import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole, requirePermission } from '../../middleware/authorize.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { ROLES, PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './tenants.controller.js';
import {
  updateTenantSchema,
  listTenantsSchema,
  setStatusSchema,
  idParamSchema,
} from './tenants.validators.js';

const router = Router();
router.use(authenticate);

/* Restaurant Admin — manage own restaurant branding/settings */
router.get('/me', requireTenant, ctrl.getMine);
router.patch(
  '/me',
  requireTenant,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({ body: updateTenantSchema }),
  ctrl.updateMine,
);

/* Super Admin — platform tenant management */
router.get('/', requireRole(ROLES.SUPER_ADMIN), validate({ query: listTenantsSchema }), ctrl.list);
router.get('/:id', requireRole(ROLES.SUPER_ADMIN), validate({ params: idParamSchema }), ctrl.getOne);
router.patch(
  '/:id/status',
  requireRole(ROLES.SUPER_ADMIN),
  validate({ params: idParamSchema, body: setStatusSchema }),
  ctrl.setStatus,
);

export default router;

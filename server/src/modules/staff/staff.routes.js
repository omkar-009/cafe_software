import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './staff.controller.js';
import {
  createStaffSchema,
  updateStaffSchema,
  resetPasswordSchema,
  listStaffSchema,
  idParamSchema,
} from './staff.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

router.get('/', requirePermission(PERMISSIONS.STAFF_VIEW), validate({ query: listStaffSchema }), ctrl.list);
router.post('/', requirePermission(PERMISSIONS.STAFF_MANAGE), validate({ body: createStaffSchema }), ctrl.create);
router.get('/:id', requirePermission(PERMISSIONS.STAFF_VIEW), validate({ params: idParamSchema }), ctrl.getOne);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validate({ params: idParamSchema, body: updateStaffSchema }),
  ctrl.update,
);
router.post(
  '/:id/reset-password',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  validate({ params: idParamSchema, body: resetPasswordSchema }),
  ctrl.resetPassword,
);
router.delete('/:id', requirePermission(PERMISSIONS.STAFF_MANAGE), validate({ params: idParamSchema }), ctrl.remove);

export default router;

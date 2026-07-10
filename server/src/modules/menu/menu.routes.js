import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './menu.controller.js';
import {
  createItemSchema,
  updateItemSchema,
  toggleItemSchema,
  listItemsSchema,
  idParamSchema,
} from './menu.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

router.get('/', requirePermission(PERMISSIONS.MENU_VIEW), validate({ query: listItemsSchema }), ctrl.list);
router.get('/:id', requirePermission(PERMISSIONS.MENU_VIEW), validate({ params: idParamSchema }), ctrl.getOne);
router.post('/', requirePermission(PERMISSIONS.MENU_MANAGE), validate({ body: createItemSchema }), ctrl.create);
router.patch('/:id', requirePermission(PERMISSIONS.MENU_MANAGE), validate({ params: idParamSchema, body: updateItemSchema }), ctrl.update);
router.patch('/:id/toggle', requirePermission(PERMISSIONS.MENU_MANAGE), validate({ params: idParamSchema, body: toggleItemSchema }), ctrl.toggle);
router.delete('/:id', requirePermission(PERMISSIONS.MENU_MANAGE), validate({ params: idParamSchema }), ctrl.remove);

export default router;

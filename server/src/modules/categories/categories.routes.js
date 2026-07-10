import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './categories.controller.js';
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesSchema,
  idParamSchema,
} from './categories.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

router.get('/', requirePermission(PERMISSIONS.MENU_VIEW), validate({ query: listCategoriesSchema }), ctrl.list);
router.get('/:id', requirePermission(PERMISSIONS.MENU_VIEW), validate({ params: idParamSchema }), ctrl.getOne);
router.post('/', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate({ body: createCategorySchema }), ctrl.create);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validate({ params: idParamSchema, body: updateCategorySchema }),
  ctrl.update,
);
router.delete('/:id', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate({ params: idParamSchema }), ctrl.remove);

export default router;

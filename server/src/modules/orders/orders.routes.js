import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './orders.controller.js';
import {
  createOrderSchema, listOrdersSchema, changeStatusSchema, cancelOrderSchema, idParamSchema,
} from './orders.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

router.get('/', requirePermission(PERMISSIONS.ORDER_VIEW), validate({ query: listOrdersSchema }), ctrl.list);
router.get('/kitchen/queue', requirePermission(PERMISSIONS.ORDER_VIEW), ctrl.kitchenQueue);
router.get('/:id', requirePermission(PERMISSIONS.ORDER_VIEW), validate({ params: idParamSchema }), ctrl.getOne);

router.post('/', requirePermission(PERMISSIONS.ORDER_CREATE), validate({ body: createOrderSchema }), ctrl.create);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.ORDER_UPDATE_STATUS),
  validate({ params: idParamSchema, body: changeStatusSchema }),
  ctrl.changeStatus,
);
router.post('/:id/serve', requirePermission(PERMISSIONS.ORDER_SERVE), validate({ params: idParamSchema }), ctrl.serve);
router.post('/:id/cancel', requirePermission(PERMISSIONS.ORDER_CANCEL), validate({ params: idParamSchema, body: cancelOrderSchema }), ctrl.cancel);

export default router;

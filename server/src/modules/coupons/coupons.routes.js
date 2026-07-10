import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './coupons.controller.js';
import { createCouponSchema, updateCouponSchema, listCouponsSchema, idParamSchema } from './coupons.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

router.get('/', requirePermission(PERMISSIONS.COUPON_VIEW), validate({ query: listCouponsSchema }), ctrl.list);
router.get('/:id', requirePermission(PERMISSIONS.COUPON_VIEW), validate({ params: idParamSchema }), ctrl.getOne);
router.post('/', requirePermission(PERMISSIONS.COUPON_MANAGE), validate({ body: createCouponSchema }), ctrl.create);
router.patch('/:id', requirePermission(PERMISSIONS.COUPON_MANAGE), validate({ params: idParamSchema, body: updateCouponSchema }), ctrl.update);
router.delete('/:id', requirePermission(PERMISSIONS.COUPON_MANAGE), validate({ params: idParamSchema }), ctrl.remove);

export default router;

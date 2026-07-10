import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './billing.controller.js';
import { paySchema, orderIdParamSchema } from './billing.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

router.post(
  '/orders/:orderId/pay',
  requirePermission(PERMISSIONS.PAYMENT_COMPLETE),
  validate({ params: orderIdParamSchema, body: paySchema }),
  ctrl.pay,
);
router.get(
  '/orders/:orderId/invoice',
  requirePermission(PERMISSIONS.BILL_VIEW),
  validate({ params: orderIdParamSchema }),
  ctrl.getInvoice,
);
// PDF download / reprint
router.get(
  '/orders/:orderId/invoice.pdf',
  requirePermission(PERMISSIONS.BILL_GENERATE),
  validate({ params: orderIdParamSchema }),
  ctrl.downloadInvoice,
);

export default router;

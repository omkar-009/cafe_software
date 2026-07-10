import { Router } from 'express';
import { z } from 'zod';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './analytics.controller.js';

const router = Router();
router.use(authenticate, requireTenant);

const rangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  format: z.enum(['csv', 'xlsx']).optional(),
});

router.get('/dashboard', requirePermission(PERMISSIONS.ANALYTICS_VIEW), validate({ query: rangeSchema }), ctrl.dashboard);
router.get('/reports/sales', requirePermission(PERMISSIONS.REPORT_EXPORT), validate({ query: rangeSchema }), ctrl.exportSales);

export default router;

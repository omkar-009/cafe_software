import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './attendance.controller.js';
import {
  markSchema, registerQuerySchema, summaryQuerySchema, postSalariesSchema,
} from './attendance.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

/* Self — any staff member */
router.post('/check-in', requirePermission(PERMISSIONS.ATTENDANCE_SELF), ctrl.checkIn);
router.post('/check-out', requirePermission(PERMISSIONS.ATTENDANCE_SELF), ctrl.checkOut);
router.get('/me', requirePermission(PERMISSIONS.ATTENDANCE_SELF), ctrl.me);

/* Admin */
router.get('/register', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), validate({ query: registerQuerySchema }), ctrl.register);
router.get('/summary', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), validate({ query: summaryQuerySchema }), ctrl.summary);
router.get('/summary/export', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), ctrl.exportSummary);
router.post('/mark', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), validate({ body: markSchema }), ctrl.mark);
router.post('/post-salaries', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), validate({ body: postSalariesSchema }), ctrl.postSalaries);

export default router;

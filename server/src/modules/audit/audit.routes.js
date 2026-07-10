import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './audit.controller.js';
import { listAuditSchema, exportAuditSchema } from './audit.validators.js';

const router = Router();
router.use(authenticate, requireTenant, requirePermission(PERMISSIONS.AUDIT_VIEW));

router.get('/', validate({ query: listAuditSchema }), ctrl.list);
router.get('/facets', ctrl.facets);
router.get('/export', validate({ query: exportAuditSchema }), ctrl.exportLogs);

export default router;

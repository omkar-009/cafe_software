import { Router } from 'express';
import { z } from 'zod';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import * as ctrl from './notifications.controller.js';

const router = Router();
router.use(authenticate, requireTenant);

router.get('/', ctrl.list);
router.post('/read-all', ctrl.markAllRead);
router.post('/:id/read', validate({ params: z.object({ id: z.string().uuid() }) }), ctrl.markRead);

export default router;

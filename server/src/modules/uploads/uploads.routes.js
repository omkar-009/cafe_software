import { Router } from 'express';
import { z } from 'zod';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import catchAsync from '../../shared/catchAsync.js';
import { ok } from '../../shared/ApiResponse.js';
import { createSignedUpload, isStorageConfigured } from '../../shared/storage.js';

const router = Router();
router.use(authenticate, requireTenant);

const schema = z.object({
  folder: z.enum(['logo', 'cover', 'menu', 'category', 'misc']).default('misc'),
  filename: z.string().min(1).max(200),
});

/**
 * Issue a signed upload URL. The client PUTs the file to `signedUrl`, then
 * persists the returned `publicUrl` on the relevant record.
 */
router.post(
  '/signed-url',
  validate({ body: schema }),
  catchAsync(async (req, res) => {
    const result = await createSignedUpload({
      tenantId: req.tenantId,
      folder: req.body.folder,
      filename: req.body.filename,
    });
    return ok(res, result, { message: 'Signed upload URL created' });
  }),
);

router.get('/status', (_req, res) => ok(res, { configured: isStorageConfigured() }));

export default router;

/**
 * Uploads module — two strategies:
 *   1. Local disk (default, always available): POST /uploads/image (multipart)
 *      saves to server/uploads/<tenant>/ and serves it publicly at
 *      /uploads/files/... so menu/logo images load without auth.
 *   2. Supabase Storage signed-URL flow (when SUPABASE_* is configured) for
 *      durable, multi-instance object storage.
 *
 * NOTE: local disk is fine for single-instance/dev. For production behind a load
 * balancer, configure Supabase Storage so images are shared + durable.
 */
import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import catchAsync from '../../shared/catchAsync.js';
import ApiError from '../../shared/ApiError.js';
import { ok } from '../../shared/ApiResponse.js';
import env from '../../config/env.js';
import { createSignedUpload, isStorageConfigured } from '../../shared/storage.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Public: serve uploaded images (no auth — customer menu must load them) ──
router.use('/files', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));

// ── Everything below requires auth + tenant ──
router.use(authenticate, requireTenant);

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const dir = path.join(UPLOAD_DIR, req.tenantId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = (path.extname(file.originalname).toLowerCase().match(/\.[a-z0-9]+/) || ['.png'])[0];
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter(_req, file, cb) {
    if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(ApiError.badRequest('Only image files (png, jpg, webp, gif, svg) are allowed'));
  },
});

// Wrap multer so its errors become clean 400s instead of unhandled 500s.
const uploadSingle = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('Image must be under 3MB'));
    return next(err instanceof ApiError ? err : ApiError.badRequest(err.message));
  });

/** Direct multipart upload → returns a same-origin public URL to persist. */
router.post(
  '/image',
  uploadSingle,
  catchAsync(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded (field name must be "file")');
    const url = `${env.API_PREFIX}/uploads/files/${req.tenantId}/${req.file.filename}`;
    return ok(res, { url }, { message: 'Image uploaded' });
  }),
);

/** Supabase signed-URL flow (used when object storage is configured). */
const signedSchema = z.object({
  folder: z.enum(['logo', 'cover', 'menu', 'category', 'misc']).default('misc'),
  filename: z.string().min(1).max(200),
});
router.post(
  '/signed-url',
  validate({ body: signedSchema }),
  catchAsync(async (req, res) => {
    const result = await createSignedUpload({
      tenantId: req.tenantId,
      folder: req.body.folder,
      filename: req.body.filename,
    });
    return ok(res, result, { message: 'Signed upload URL created' });
  }),
);

router.get('/status', (_req, res) =>
  ok(res, { supabaseConfigured: isStorageConfigured(), localUpload: true }));

export default router;

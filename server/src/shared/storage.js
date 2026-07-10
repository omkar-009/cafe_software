/**
 * Supabase Storage service.
 *
 * Strategy: the backend never proxies large binaries. Instead it issues a
 * short-lived **signed upload URL**; the client PUTs the file straight to
 * Supabase, then sends us back the resulting public URL to persist.
 *
 * If Supabase credentials are not configured (e.g. local dev before secrets are
 * provided), the service degrades gracefully and reports `configured: false`
 * so callers can fall back to plain URL strings.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import env from '../config/env.js';
import logger from '../config/logger.js';
import ApiError from './ApiError.js';

// Treat obvious placeholder values as "not configured".
const configured =
  Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) &&
  !env.SUPABASE_URL.includes('your-project') &&
  !env.SUPABASE_SERVICE_KEY.includes('your-service');

let client = null;

/**
 * Lazily construct the Supabase client on first use. Building it at module load
 * would crash boot on Node < 22 (realtime-js WebSocket check) even when storage
 * is never used — so we defer it until an actual upload is requested.
 */
function getClient() {
  if (!configured) return null;
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
      realtime: { disabled: true },
    });
    logger.info('✅ Supabase Storage client initialized');
  }
  return client;
}

if (!configured) {
  logger.warn('⚠ Supabase Storage not configured — image uploads disabled until credentials are set');
}

export function isStorageConfigured() {
  return configured;
}

/**
 * Create a signed upload URL scoped to a tenant folder.
 * @returns {{ path, token, signedUrl, publicUrl }}
 */
export async function createSignedUpload({ tenantId, folder = 'misc', filename }) {
  const sb = getClient();
  if (!sb) throw ApiError.badRequest('File storage is not configured on this server');
  const safeName = (filename || 'file').replace(/[^\w.\-]/g, '_');
  const path = `${tenantId}/${folder}/${randomUUID()}-${safeName}`;

  const { data, error } = await sb.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error) throw ApiError.internal(`Storage error: ${error.message}`);

  const { data: pub } = sb.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
  return { path, token: data.token, signedUrl: data.signedUrl, publicUrl: pub.publicUrl };
}

/** Delete an object by its storage path (best-effort). */
export async function deleteObject(path) {
  const sb = getClient();
  if (!sb || !path) return;
  const { error } = await sb.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([path]);
  if (error) logger.warn({ error: error.message, path }, 'Failed to delete storage object');
}

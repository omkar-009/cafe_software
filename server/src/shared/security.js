/**
 * Cryptographic helpers: password hashing, JWT issue/verify, token hashing,
 * and signed QR payloads.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import env from '../config/env.js';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Access token — short lived, carries identity + role + tenant. */
export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: env.APP_NAME,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: env.APP_NAME });
}

/** Refresh token — opaque random string; only its hash is stored server-side. */
export function generateRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sign a table QR payload. The QR encodes tenant/floor/table ids plus an HMAC
 * over the rotating per-table token so a stale or forged QR is rejected.
 */
export function signQrPayload({ tenantId, floorId, tableId, qrToken, qrVersion }) {
  const base = `${tenantId}.${floorId || ''}.${tableId}.${qrToken}.${qrVersion}`;
  const sig = createHmac('sha256', env.QR_TOKEN_SECRET).update(base).digest('base64url');
  return { t: tenantId, f: floorId || null, b: tableId, k: qrToken, v: qrVersion, s: sig };
}

export function verifyQrSignature(payload) {
  if (!payload || !payload.s) return false;
  const base = `${payload.t}.${payload.f || ''}.${payload.b}.${payload.k}.${payload.v}`;
  const expected = createHmac('sha256', env.QR_TOKEN_SECRET).update(base).digest('base64url');
  return timingSafeEqualStr(expected, payload.s);
}

function timingSafeEqualStr(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

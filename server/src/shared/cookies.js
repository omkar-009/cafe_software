/**
 * Cookie helpers for auth tokens. Access + refresh tokens are stored in
 * HTTP-only cookies (not accessible to JS → mitigates XSS token theft).
 */
import env, { isProd } from '../config/env.js';
import ms from './ms.js';

export const ACCESS_COOKIE = 'rs_access';
export const REFRESH_COOKIE = 'rs_refresh';
export const CSRF_COOKIE = 'rs_csrf';

function baseOptions() {
  return {
    httpOnly: true,
    // SameSite=None (cross-site cookies) REQUIRES Secure — force it on.
    secure: env.COOKIE_SECURE || isProd || env.COOKIE_SAME_SITE === 'none',
    sameSite: env.COOKIE_SAME_SITE,
    // Empty / localhost → host-only cookie (correct for a single API domain).
    domain: !env.COOKIE_DOMAIN || env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
    path: '/',
  };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions(),
    maxAge: ms(env.JWT_ACCESS_TTL),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(),
    maxAge: ms(env.JWT_REFRESH_TTL),
    path: '/', // refresh endpoint reads it; keep root path for simplicity
  });
}

/** CSRF cookie is readable by JS (double-submit pattern) so it is NOT httpOnly. */
export function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, {
    ...baseOptions(),
    httpOnly: false,
    maxAge: ms(env.JWT_REFRESH_TTL),
  });
}

export function clearAuthCookies(res) {
  const opts = { ...baseOptions() };
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false });
}

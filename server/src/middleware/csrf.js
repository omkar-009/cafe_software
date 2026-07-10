/**
 * Stateless CSRF protection using the double-submit cookie pattern.
 *
 * A non-httpOnly `rs_csrf` cookie is set at login. For unsafe methods the client
 * must echo it in the `X-CSRF-Token` header; we compare the two. Because a
 * cross-site attacker cannot read the victim's cookie, they cannot forge the
 * matching header.
 *
 * Bearer-token API clients (no cookie) are exempt — they are not subject to CSRF.
 */
import ApiError from '../shared/ApiError.js';
import { CSRF_COOKIE, ACCESS_COOKIE } from '../shared/cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  // Only cookie-authenticated sessions need CSRF; pure Bearer clients are exempt.
  const usesCookieAuth = Boolean(req.cookies?.[ACCESS_COOKIE]);
  if (!usesCookieAuth) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(ApiError.forbidden('Invalid or missing CSRF token'));
  }
  return next();
}

import catchAsync from '../../shared/catchAsync.js';
import { ok, created } from '../../shared/ApiResponse.js';
import { setAuthCookies, clearAuthCookies, setCsrfCookie, REFRESH_COOKIE, CSRF_COOKIE } from '../../shared/cookies.js';
import { generateRefreshToken } from '../../shared/security.js';
import * as authService from './auth.service.js';

/**
 * Ensure a CSRF token exists and RETURN it in the body.
 * Cross-origin deploys (frontend + API on different domains) can't read the
 * CSRF cookie from JS, so the client stores this value and echoes it in the
 * X-CSRF-Token header. Same-origin still works via the cookie.
 */
function issueCsrf(req, res, { fresh = false } = {}) {
  let token = fresh ? null : req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = generateRefreshToken();
    setCsrfCookie(res, token);
  }
  return token;
}

export const register = catchAsync(async (req, res) => {
  const result = await authService.registerTenant(req.body, req.clientCtx);
  setAuthCookies(res, result);
  const csrfToken = issueCsrf(req, res, { fresh: true });
  return created(res, { user: result.user, csrfToken }, { message: 'Restaurant registered successfully' });
});

export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body, req.clientCtx);
  setAuthCookies(res, result);
  const csrfToken = issueCsrf(req, res, { fresh: true });
  return ok(res, { user: result.user, csrfToken }, { message: 'Signed in successfully' });
});

export const refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(req.cookies?.[REFRESH_COOKIE], req.clientCtx);
  setAuthCookies(res, result);
  const csrfToken = issueCsrf(req, res);
  return ok(res, { user: result.user, csrfToken }, { message: 'Session refreshed' });
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE], req);
  clearAuthCookies(res);
  return ok(res, null, { message: 'Signed out' });
});

export const me = catchAsync(async (req, res) => {
  const user = await authService.me(req.user.id);
  const csrfToken = issueCsrf(req, res);
  return ok(res, { user, csrfToken });
});

import catchAsync from '../../shared/catchAsync.js';
import { ok, created } from '../../shared/ApiResponse.js';
import { setAuthCookies, clearAuthCookies, setCsrfCookie, REFRESH_COOKIE } from '../../shared/cookies.js';
import { generateRefreshToken } from '../../shared/security.js';
import * as authService from './auth.service.js';

export const register = catchAsync(async (req, res) => {
  const result = await authService.registerTenant(req.body, req.clientCtx);
  setAuthCookies(res, result);
  setCsrfCookie(res, generateRefreshToken());
  return created(res, { user: result.user }, { message: 'Restaurant registered successfully' });
});

export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body, req.clientCtx);
  setAuthCookies(res, result);
  setCsrfCookie(res, generateRefreshToken());
  return ok(res, { user: result.user }, { message: 'Signed in successfully' });
});

export const refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(req.cookies?.[REFRESH_COOKIE], req.clientCtx);
  setAuthCookies(res, result);
  return ok(res, { user: result.user }, { message: 'Session refreshed' });
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE], req);
  clearAuthCookies(res);
  return ok(res, null, { message: 'Signed out' });
});

export const me = catchAsync(async (req, res) => {
  const user = await authService.me(req.user.id);
  return ok(res, { user });
});

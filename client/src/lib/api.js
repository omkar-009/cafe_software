import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1';

export function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach CSRF token (double-submit) on unsafe methods.
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCookie('rs_csrf');
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  // For file uploads, drop the JSON Content-Type so the browser sets the correct
  // multipart/form-data header (with boundary).
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete ? config.headers.delete('Content-Type') : (config.headers['Content-Type'] = undefined);
  }
  return config;
});

// Endpoints whose own 401 must NOT trigger a refresh (would loop or is genuine).
// NOTE: /auth/me IS allowed to refresh — that's how an expired access token is
// silently renewed from a still-valid refresh token on app load.
const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/logout'];

// Transparent access-token refresh on 401 (single retry), then bubble up.
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const skip = NO_REFRESH.some((p) => config?.url?.includes(p));
    if (response?.status === 401 && config && !config._retry && !skip) {
      config._retry = true;
      try {
        // Dedupe concurrent refreshes into a single in-flight request.
        refreshing = refreshing || api.post('/auth/refresh');
        await refreshing;
        refreshing = null;
        return api(config); // retry the original request with the new access cookie
      } catch (e) {
        refreshing = null;
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  },
);

/** Unwrap the standard { success, data } envelope, throwing a friendly error. */
export async function request(promise) {
  try {
    const { data } = await promise;
    return data.data;
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message || 'Something went wrong';
    const e = new Error(message);
    e.code = err.response?.data?.error?.code;
    e.details = err.response?.data?.error?.details;
    e.status = err.response?.status;
    throw e;
  }
}

export default api;

/**
 * Attaches per-request context used throughout the app and audit logging:
 *   req.id        → correlation id
 *   req.clientCtx → { ip, userAgent, browser, os, device }
 *
 * A tiny dependency-free UA parser keeps the audit fields populated without
 * pulling a heavy library.
 */
import { randomUUID } from 'node:crypto';

function parseUserAgent(ua = '') {
  const lc = ua.toLowerCase();

  const os =
    /windows/.test(lc) ? 'Windows' :
    /android/.test(lc) ? 'Android' :
    /iphone|ipad|ipod/.test(lc) ? 'iOS' :
    /mac os x/.test(lc) ? 'macOS' :
    /linux/.test(lc) ? 'Linux' :
    'Unknown';

  const browser =
    /edg\//.test(lc) ? 'Edge' :
    /opr\/|opera/.test(lc) ? 'Opera' :
    /chrome\//.test(lc) ? 'Chrome' :
    /firefox\//.test(lc) ? 'Firefox' :
    /safari\//.test(lc) ? 'Safari' :
    'Unknown';

  const device =
    /mobile/.test(lc) ? 'Mobile' :
    /tablet|ipad/.test(lc) ? 'Tablet' :
    'Desktop';

  return { browser, os, device };
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

export default function requestContext(req, _res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  const userAgent = req.headers['user-agent'] || '';
  req.clientCtx = {
    ip: clientIp(req),
    userAgent,
    ...parseUserAgent(userAgent),
  };
  next();
}

/**
 * Express application factory. Assembles security, parsing, logging, routing,
 * and error-handling middleware. The HTTP server + Socket.IO are attached in
 * server.js so the app stays transport-agnostic and testable.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import env, { isDev } from './config/env.js';
import logger from './config/logger.js';
import requestContext from './middleware/requestContext.js';
import csrfProtection from './middleware/csrf.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import apiRouter from './routes/index.js';
import healthRouter from './routes/health.routes.js';

export function createApp() {
  const app = express();

  // Behind NGINX/load balancer — trust the first proxy for correct client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // API only; CSP is enforced at the web/NGINX tier
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS — allow-list in production; in development reflect any origin so the
  // app works when opened from a phone/tablet on the LAN (QR testing) or a LAN IP.
  // CORS_ORIGINS entries may include `*` wildcards, e.g. `https://*.vercel.app`
  // to cover Vercel preview deployments.
  const originAllowed = (origin) =>
    env.CORS_ORIGINS.some((o) => {
      if (o === origin) return true;
      if (o.includes('*')) {
        const re = new RegExp(`^${o.replace(/[.]/g, '\\.').replace(/\*/g, '[^.]*')}$`);
        return re.test(origin);
      }
      return false;
    });
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || isDev || originAllowed(origin)) return cb(null, true);
        // Allow private-LAN origins (192.168.x, 10.x, 172.16–31.x) for on-site devices.
        if (/^https?:\/\/(?:localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(origin)) {
          return cb(null, true);
        }
        return cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestContext);

  // Structured HTTP request logging
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => req.url.startsWith('/health') },
    }),
  );

  // Health checks (no rate limit, no versioning)
  app.use('/', healthRouter);

  // Versioned API with global rate limit + CSRF
  app.use(env.API_PREFIX, globalLimiter, csrfProtection, apiRouter);

  // Optional single-origin deploy: serve the built SPA from this server so the
  // frontend and API share one domain (no cross-site cookie/CSRF concerns).
  if (env.SERVE_CLIENT) {
    const clientDist = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../client/dist');
    app.use(express.static(clientDist, { index: false, maxAge: '1y' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) return next();
      return res.sendFile(path.join(clientDist, 'index.html'));
    });
    logger.info(`🖥  Serving client from ${clientDist}`);
  }

  // 404 + centralized error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;

/**
 * Structured application logger (pino).
 * Pretty-prints in dev, JSON in production for log aggregators.
 */
import pino from 'pino';
import { createRequire } from 'node:module';
import env, { isProd } from './env.js';

// Pretty logs only in dev AND only if pino-pretty is actually installed
// (production images omit devDependencies). Falls back to JSON otherwise.
const require = createRequire(import.meta.url);
let prettyAvailable = false;
if (!isProd) {
  try { require.resolve('pino-pretty'); prettyAvailable = true; } catch { prettyAvailable = false; }
}

const logger = pino({
  level: env.LOG_LEVEL,
  base: { app: env.APP_NAME },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: prettyAvailable
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,app' },
      }
    : undefined,
});

export default logger;

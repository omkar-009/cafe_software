/**
 * Server entrypoint. Boots the HTTP server + Socket.IO, verifies the database
 * connection, and wires graceful shutdown.
 */
import http from 'node:http';
import os from 'node:os';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';
import { assertDatabaseConnection, closePool } from './config/database.js';
import env, { isDev } from './config/env.js';
import logger from './config/logger.js';

/** First non-internal IPv4 address (for phone/tablet QR testing over Wi-Fi). */
function lanIp() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return null;
}

async function bootstrap() {
  await assertDatabaseConnection();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`🚀 ${env.APP_NAME} API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`   Health: http://localhost:${env.PORT}/health`);
    logger.info(`   Env: ${env.NODE_ENV}`);
    if (isDev && !env.PUBLIC_URL) {
      const ip = lanIp();
      if (ip) {
        logger.info('📱 Phone/tablet testing: run the client with the same LAN, then set');
        logger.info(`   PUBLIC_URL=http://${ip}:5173  in server/.env and restart, so table QR codes open on your phone.`);
      }
    }
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await closePool();
      logger.info('HTTP server closed. Bye 👋');
      process.exit(0);
    });
    // Force-exit if connections linger
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

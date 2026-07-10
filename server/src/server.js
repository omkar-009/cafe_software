/**
 * Server entrypoint. Boots the HTTP server + Socket.IO, verifies the database
 * connection, and wires graceful shutdown.
 */
import http from 'node:http';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';
import { assertDatabaseConnection, closePool } from './config/database.js';
import env from './config/env.js';
import logger from './config/logger.js';

async function bootstrap() {
  await assertDatabaseConnection();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`🚀 ${env.APP_NAME} API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`   Health: http://localhost:${env.PORT}/health`);
    logger.info(`   Env: ${env.NODE_ENV}`);
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

/**
 * Socket.IO gateway.
 *
 * Rooms model:
 *   tenant:<tenantId>              → all staff of a restaurant
 *   tenant:<tenantId>:KITCHEN      → kitchen display screens
 *   tenant:<tenantId>:WAITER       → waiter devices
 *   tenant:<tenantId>:RESTAURANT_ADMIN
 *   user:<userId>                  → a specific user (direct notifications)
 *   order:<orderId>                → customers tracking a single order
 *
 * Authentication reuses the access-token cookie / auth handshake so a socket
 * can only ever join its own tenant's rooms — the same isolation guarantee as
 * the HTTP layer. WebSocket transport with automatic long-polling fallback.
 */
import { Server } from 'socket.io';
import cookie from 'cookie';
import env, { isDev } from '../config/env.js';
import logger from '../config/logger.js';
import { verifyAccessToken } from '../shared/security.js';
import { ACCESS_COOKIE } from '../shared/cookies.js';

let io = null;

function authenticateSocket(socket, next) {
  try {
    const raw = socket.handshake.headers.cookie;
    const token =
      socket.handshake.auth?.token ||
      (raw ? cookie.parse(raw)[ACCESS_COOKIE] : null);
    if (!token) return next(new Error('unauthorized'));
    const payload = verifyAccessToken(token);
    socket.data.user = {
      id: payload.sub,
      tenantId: payload.tenantId ?? null,
      role: payload.role,
    };
    return next();
  } catch {
    return next(new Error('unauthorized'));
  }
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    // Dev: reflect any origin (LAN devices); prod: the configured allow-list.
    cors: { origin: isDev ? true : env.CORS_ORIGINS, credentials: true },
    transports: ['websocket', 'polling'],
    path: '/socket.io',
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { id, tenantId, role } = socket.data.user;
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
      socket.join(`tenant:${tenantId}:${role}`);
    }
    socket.join(`user:${id}`);
    logger.debug({ socketId: socket.id, userId: id, tenantId, role }, 'socket connected');

    // Customers tracking a specific order join its room explicitly.
    socket.on('order:subscribe', (orderId) => {
      if (typeof orderId === 'string') socket.join(`order:${orderId}`);
    });
    socket.on('order:unsubscribe', (orderId) => {
      if (typeof orderId === 'string') socket.leave(`order:${orderId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'socket disconnected');
    });
  });

  logger.info('✅ Socket.IO gateway initialized');
  return io;
}

/** Access the initialized io instance from anywhere (services emit events). */
export function getIo() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

/** Emit to every staff member of a tenant. */
export function emitToTenant(tenantId, event, payload) {
  if (io) io.to(`tenant:${tenantId}`).emit(event, payload);
}

/** Emit to a specific role within a tenant (e.g. KITCHEN, WAITER). */
export function emitToRole(tenantId, role, event, payload) {
  if (io) io.to(`tenant:${tenantId}:${role}`).emit(event, payload);
}

/** Emit to a single user. */
export function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

/** Emit to everyone tracking a single order (customers). */
export function emitToOrder(orderId, event, payload) {
  if (io) io.to(`order:${orderId}`).emit(event, payload);
}

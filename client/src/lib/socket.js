import { io } from 'socket.io-client';

let socket = null;

/** Connect the authenticated socket (cookie-based handshake). Idempotent. */
export function connectSocket() {
  if (socket?.connected) return socket;
  socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

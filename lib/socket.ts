"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    socket = io(url, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });
  }
  return socket;
}

/**
 * @deprecated Use SocketProvider instead. This will be removed in a future version.
 */
export function connectSocket(token: string) {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/**
 * @deprecated Use SocketProvider instead. This will be removed in a future version.
 */
export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

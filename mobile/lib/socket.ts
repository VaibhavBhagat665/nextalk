import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.1.100:3001';

class SocketService {
  private socket: Socket | null = null;

  connect(userId: string, username: string, imageUrl: string, token: string) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: {
        userId,
        username,
        imageUrl,
        token,
      },
      transports: ['websocket'], // Force WebSocket for better performance
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();

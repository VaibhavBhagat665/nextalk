import { io, Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { messageQueueService } from './message-queue';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.1.100:3001';

class SocketService {
  private socket: Socket | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private authData: {
    userId: string;
    username: string;
    imageUrl: string;
    token: string;
  } | null = null;

  constructor() {
    // Listen to app state changes (background/foreground)
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to foreground - reconnect if needed
      console.log('App came to foreground - checking socket connection');
      this.attemptReconnect();
    } else if (nextAppState === 'background') {
      // App went to background - keep connection alive but reduce activity
      console.log('App went to background');
    }

    this.appState = nextAppState;
  };

  private attemptReconnect() {
    if (!this.socket?.connected && this.authData) {
      console.log('Attempting to reconnect socket...');
      this.connect(
        this.authData.userId,
        this.authData.username,
        this.authData.imageUrl,
        this.authData.token
      );
    }
  }

  connect(userId: string, username: string, imageUrl: string, token: string) {
    // Store auth data for reconnection
    this.authData = { userId, username, imageUrl, token };

    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log('Connecting socket to:', SOCKET_URL);

    this.socket = io(SOCKET_URL, {
      auth: {
        userId,
        username,
        imageUrl,
        token,
      },
      transports: ['websocket'], // Force WebSocket for better performance on mobile
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Process any pending queued messages when connection is restored
      messageQueueService.processPendingMessages();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      
      // If disconnected due to server or network issue, schedule reconnect
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      this.scheduleReconnect();
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnect attempt:', attemptNumber);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      
      // Process queued messages after reconnection
      messageQueueService.processPendingMessages();
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    // Avoid multiple reconnect timeouts
    if (this.reconnectTimeout) return;

    // Only schedule reconnect if app is in foreground
    if (this.appState === 'active' && this.authData) {
      this.reconnectTimeout = setTimeout(() => {
        console.log('Scheduled reconnect executing...');
        this.attemptReconnect();
        this.reconnectTimeout = null;
      }, 3000);
    }
  }

  disconnect() {
    console.log('Disconnecting socket...');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.authData = null;
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();

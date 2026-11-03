"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";

type SocketStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();
  const { user } = useUser();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isInitializedRef = useRef(false);

  const getFreshToken = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token available");
      return token;
    } catch (err) {
      console.error("[SocketProvider] Failed to get auth token:", err);
      throw err;
    }
  }, [getToken]);

  const connect = useCallback(async () => {
    if (!userId || !user) {
      console.log("[SocketProvider] Skipping connect: no user");
      return;
    }

    try {
      setStatus("connecting");
      setError(null);

      const token = await getFreshToken();
      const socketInstance = getSocket();

      // Set auth with ONLY the JWT token (server extracts userId/username from JWT)
      socketInstance.auth = {
        token,
      };

      // Connect if not already connected
      if (!socketInstance.connected) {
        socketInstance.connect();
      }

      setSocket(socketInstance);
    } catch (err: any) {
      console.error("[SocketProvider] Connection error:", err);
      setError(err.message || "Failed to connect");
      setStatus("error");
    }
  }, [userId, user, getFreshToken]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Initialize socket connection once on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    if (!userId || !user) return;

    isInitializedRef.current = true;
    connect();

    return () => {
      // Only disconnect on unmount (sign-out or app close)
      const socketInstance = getSocket();
      if (socketInstance?.connected) {
        console.log("[SocketProvider] Disconnecting on unmount");
        socketInstance.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [userId, user, connect]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log("[SocketProvider] Connected");
      setStatus("connected");
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    const handleDisconnect = (reason: string) => {
      console.log("[SocketProvider] Disconnected:", reason);
      setStatus("disconnected");

      // Auto-reconnect unless explicitly disconnected by the client
      if (reason !== "io client disconnect") {
        setStatus("reconnecting");
        
        // Exponential backoff: 500ms, 1s, 2s, 4s, max 10s
        const delay = Math.min(
          500 * Math.pow(2, reconnectAttemptsRef.current),
          10000
        );
        
        console.log(`[SocketProvider] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      }
    };

    const handleConnectError = (err: Error) => {
      console.error("[SocketProvider] Connection error:", err);
      setError(err.message || "Connection failed");
      setStatus("error");
      
      // Retry with exponential backoff
      const delay = Math.min(
        500 * Math.pow(2, reconnectAttemptsRef.current),
        10000
      );
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current += 1;
        connect();
      }, delay);
    };

    const handleReconnect = (attemptNumber: number) => {
      console.log(`[SocketProvider] Reconnected after ${attemptNumber} attempts`);
      setStatus("connected");
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    const handleReconnectAttempt = (attemptNumber: number) => {
      console.log(`[SocketProvider] Reconnection attempt ${attemptNumber}`);
      setStatus("reconnecting");
    };

    const handleReconnectFailed = () => {
      console.error("[SocketProvider] Reconnection failed after max attempts");
      setStatus("error");
      setError("Failed to reconnect. Please refresh the page.");
    };

    // Attach listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("reconnect", handleReconnect);
    socket.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("reconnect_failed", handleReconnectFailed);

    // Set initial status
    setStatus(socket.connected ? "connected" : "disconnected");

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("reconnect", handleReconnect);
      socket.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("reconnect_failed", handleReconnectFailed);
    };
  }, [socket, connect]);

  const value: SocketContextValue = {
    socket,
    status,
    isConnected: status === "connected",
    error,
    reconnect,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocketContext must be used within a SocketProvider");
  }
  return context;
}

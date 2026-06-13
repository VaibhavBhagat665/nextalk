"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";

interface Message {
  id?: string;
  tempId?: string;
  content: string;
  userId: string;
  username: string;
  imageUrl: string;
  channelId: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: string;
  reactions?: { emoji: string; userId: string; username: string }[];
}

interface OnlineUser {
  userId: string;
  username: string;
  imageUrl: string;
}

interface TypingUser {
  userId: string;
  username: string;
}

export function useSocket(channelId: string | null) {
  const { getToken, userId } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const prevChannelRef = useRef<string | null>(null);

  // Connect socket — only re-run when userId changes
  useEffect(() => {
    if (!userId || !user) return;

    const connect = async () => {
      try {
        const token = await getToken();
        const socket = connectSocket(token || "");

        // Set auth data
        socket.auth = {
          token,
          userId,
          username: user.username || user.firstName || "User",
          imageUrl: user.imageUrl || "",
        };

        if (!socket.connected) {
          socket.connect();
        }

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onPresence = (users: OnlineUser[]) => setOnlineUsers(users);

        socket.off("connect", onConnect).on("connect", onConnect);
        socket.off("disconnect", onDisconnect).on("disconnect", onDisconnect);
        socket.off("presence:update", onPresence).on("presence:update", onPresence);
      } catch (error) {
        console.error("Socket connection error:", error);
      }
    };

    connect();

    return () => {
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Join/leave channel rooms
  useEffect(() => {
    const socket = getSocket();
    if (!channelId) return;

    const joinChannel = () => {
      // Leave previous channel
      if (prevChannelRef.current && prevChannelRef.current !== channelId) {
        socket.emit("channel:leave", prevChannelRef.current);
      }
      socket.emit("channel:join", channelId);
      prevChannelRef.current = channelId;
    };

    if (socket?.connected) {
      joinChannel();
    }
    // Also listen for (re)connect to join automatically
    socket.on("connect", joinChannel);

    // Clear typing but keep stale messages until new ones load
    setTypingUsers([]);

    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      if (message.channelId === channelId) {
        setMessages((prev) => {
          // Replace temp message if it exists
          if (message.tempId) {
            const exists = prev.find((m) => m.tempId === message.tempId);
            if (exists) {
              return prev.map((m) =>
                m.tempId === message.tempId ? { ...message, id: message.id || message.tempId } : m
              );
            }
          }
          return [...prev, message];
        });
      }
    };

    const handleReaction = (data: {
      messageId: string;
      emoji: string;
      userId: string;
      username: string;
      channelId: string;
    }) => {
      if (data.channelId === channelId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === data.messageId || m.tempId === data.messageId) {
              const reactions = m.reactions || [];
              const existing = reactions.find(
                (r) => r.emoji === data.emoji && r.userId === data.userId
              );
              if (existing) {
                return {
                  ...m,
                  reactions: reactions.filter(
                    (r) => !(r.emoji === data.emoji && r.userId === data.userId)
                  ),
                };
              }
              return {
                ...m,
                reactions: [
                  ...reactions,
                  { emoji: data.emoji, userId: data.userId, username: data.username },
                ],
              };
            }
            return m;
          })
        );
      }
    };

    const handleTyping = (data: {
      userId: string;
      username: string;
      channelId: string;
      isTyping: boolean;
    }) => {
      if (data.channelId === channelId) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            if (!prev.find((u) => u.userId === data.userId)) {
              return [...prev, { userId: data.userId, username: data.username }];
            }
            return prev;
          }
          return prev.filter((u) => u.userId !== data.userId);
        });
      }
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:reaction", handleReaction);
    socket.on("typing:update", handleTyping);

    return () => {
      socket.off("connect", joinChannel);
      socket.off("message:new", handleNewMessage);
      socket.off("message:reaction", handleReaction);
      socket.off("typing:update", handleTyping);
    };
  }, [channelId]);

  // Send message
  const sendMessage = useCallback(
    (content: string, fileUrl?: string, fileName?: string, fileType?: string) => {
      const socket = getSocket();
      if (!socket?.connected || !channelId || !userId) return;

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      socket.emit("message:send", {
        channelId,
        content,
        fileUrl,
        fileName,
        fileType,
        tempId,
      });
    },
    [channelId, userId]
  );

  // Typing indicators
  const startTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket?.connected || !channelId) return;

    socket.emit("typing:start", channelId);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("typing:stop", channelId);
    }, 3000);
  }, [channelId]);

  // React to message
  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      const socket = getSocket();
      if (!socket?.connected || !channelId) return;

      socket.emit("message:react", { messageId, emoji, channelId });
    },
    [channelId]
  );

  return {
    messages,
    setMessages,
    onlineUsers,
    typingUsers,
    isConnected,
    sendMessage,
    startTyping,
    reactToMessage,
  };
}

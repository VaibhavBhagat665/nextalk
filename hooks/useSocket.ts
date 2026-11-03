"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useSocketContext } from "@/components/providers/SocketProvider";

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
  blurhash?: string;
  imageDimensions?: { width: number; height: number };
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
  imageUrl?: string | null;
}

/**
 * Hook for channel-specific socket operations.
 * Connection management is handled by SocketProvider.
 * This hook only manages room joining/leaving and channel-specific events.
 */
export function useSocket(channelId: string | null) {
  const { socket, isConnected } = useSocketContext();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<number | null>(null);
  const prevChannelRef = useRef<string | null>(null);

  // Join/leave channel rooms
  useEffect(() => {
    if (!socket || !channelId) return;

    const joinChannel = () => {
      // Leave previous channel
      if (prevChannelRef.current && prevChannelRef.current !== channelId) {
        socket.emit("channel:leave", prevChannelRef.current);
      }
      socket.emit("channel:join", channelId);
      prevChannelRef.current = channelId;
    };

    if (socket.connected) {
      joinChannel();
    }

    // Also listen for (re)connect to rejoin automatically
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
      imageUrl?: string | null;
      channelId: string;
      isTyping: boolean;
    }) => {
      if (data.channelId === channelId) {
        setTypingUsers((prev) => {
          if (data.isTyping) {
            if (!prev.find((u) => u.userId === data.userId)) {
              return [...prev, { userId: data.userId, username: data.username, imageUrl: data.imageUrl }];
            }
            return prev;
          }
          return prev.filter((u) => u.userId !== data.userId);
        });
      }
    };

    const handlePresence = (users: OnlineUser[]) => {
      setOnlineUsers(users);
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:reaction", handleReaction);
    socket.on("typing:update", handleTyping);
    socket.on("presence:update", handlePresence);

    return () => {
      socket.off("connect", joinChannel);
      socket.off("message:new", handleNewMessage);
      socket.off("message:reaction", handleReaction);
      socket.off("typing:update", handleTyping);
      socket.off("presence:update", handlePresence);

      // Leave channel on unmount
      if (channelId) {
        socket.emit("channel:leave", channelId);
      }
    };
  }, [socket, channelId]);

  // Send message
  const sendMessage = useCallback(
    (
      content: string,
      fileUrl?: string,
      fileName?: string,
      fileType?: string,
      blurhash?: string,
      imageDimensions?: { width: number; height: number }
    ) => {
      if (!socket?.connected || !channelId || !user) return;

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const optimisticMessage: Message = {
        tempId,
        content,
        userId: user.id,
        username: user.username || user.firstName || "User",
        imageUrl: user.imageUrl || "",
        channelId,
        fileUrl,
        fileName,
        fileType,
        blurhash,
        imageDimensions,
        createdAt: new Date().toISOString(),
      };

      // Add optimistic message
      setMessages((prev) => [...prev, optimisticMessage]);

      // Send with callback to handle success/failure
      socket.emit(
        "message:send",
        {
          channelId,
          content,
          fileUrl,
          fileName,
          fileType,
          blurhash,
          imageDimensions,
          tempId,
        },
        (response: any) => {
          if (response?.error) {
            // Server rejected the message - remove optimistic message
            console.error("[useSocket] Message send failed:", response.message);
            setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
            
            // Could show a toast notification here
            // toast.error(response.message || "Failed to send message");
          }
          // If successful, the server will broadcast message:new which will update the tempId
        }
      );
    },
    [socket, channelId, user]
  );

  // Typing indicators
  const startTyping = useCallback(() => {
    if (!socket?.connected || !channelId) return;

    socket.emit("typing:start", channelId);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("typing:stop", channelId);
    }, 3000);
  }, [socket, channelId]);

  // React to message
  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      if (!socket?.connected || !channelId) return;

      socket.emit("message:react", { messageId, emoji, channelId });
    },
    [socket, channelId]
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

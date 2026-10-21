import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { socketService } from '../lib/socket';

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

export function useSocket(channelId: string | null) {
  const { getToken, userId } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevChannelRef = useRef<string | null>(null);

  // Connect socket when user is authenticated
  useEffect(() => {
    if (!userId || !user) return;

    const connect = async () => {
      try {
        const token = await getToken();
        const username = user.username || user.firstName || 'User';
        const imageUrl = user.imageUrl || '';

        socketService.connect(userId, username, imageUrl, token || '');

        const socket = socketService.getSocket();
        if (!socket) return;

        // Set up event listeners
        const onConnect = () => {
          console.log('[useSocket] Connected');
          setIsConnected(true);
        };

        const onDisconnect = (reason: string) => {
          console.log('[useSocket] Disconnected:', reason);
          setIsConnected(false);
        };

        const onPresence = (users: OnlineUser[]) => {
          setOnlineUsers(users);
        };

        socket.off('connect', onConnect).on('connect', onConnect);
        socket.off('disconnect', onDisconnect).on('disconnect', onDisconnect);
        socket.off('presence:update', onPresence).on('presence:update', onPresence);

        // Set initial connection state
        setIsConnected(socket.connected);
      } catch (error) {
        console.error('[useSocket] Connection error:', error);
      }
    };

    connect();

    return () => {
      // Don't disconnect on unmount - keep connection alive
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('presence:update');
      }
    };
  }, [userId, user, getToken]);

  // Join/leave channel rooms
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !channelId) return;

    const joinChannel = () => {
      // Leave previous channel
      if (prevChannelRef.current && prevChannelRef.current !== channelId) {
        socket.emit('channel:leave', prevChannelRef.current);
      }
      socket.emit('channel:join', channelId);
      prevChannelRef.current = channelId;
    };

    if (socket.connected) {
      joinChannel();
    }

    // Also listen for (re)connect to join automatically
    const onReconnect = () => {
      console.log('[useSocket] Reconnected, rejoining channel:', channelId);
      joinChannel();
    };

    socket.on('connect', onReconnect);

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
              return [
                ...prev,
                { userId: data.userId, username: data.username, imageUrl: data.imageUrl },
              ];
            }
            return prev;
          }
          return prev.filter((u) => u.userId !== data.userId);
        });
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:reaction', handleReaction);
    socket.on('typing:update', handleTyping);

    return () => {
      socket.off('connect', onReconnect);
      socket.off('message:new', handleNewMessage);
      socket.off('message:reaction', handleReaction);
      socket.off('typing:update', handleTyping);

      // Leave channel on cleanup
      if (channelId) {
        socket.emit('channel:leave', channelId);
      }
    };
  }, [channelId]);

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
      const socket = socketService.getSocket();
      if (!socket?.connected || !channelId || !userId || !user) {
        console.warn('[useSocket] Cannot send message - not connected or missing data');
        return;
      }

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const optimisticMessage: Message = {
        tempId,
        content,
        userId,
        username: user.username || user.firstName || 'User',
        imageUrl: user.imageUrl || '',
        channelId,
        fileUrl,
        fileName,
        fileType,
        blurhash,
        imageDimensions,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      socket.emit('message:send', {
        channelId,
        content,
        fileUrl,
        fileName,
        fileType,
        blurhash,
        imageDimensions,
        tempId,
      });
    },
    [channelId, userId, user]
  );

  // Typing indicators
  const startTyping = useCallback(() => {
    const socket = socketService.getSocket();
    if (!socket?.connected || !channelId) return;

    socket.emit('typing:start', channelId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', channelId);
    }, 3000);
  }, [channelId]);

  // React to message
  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      const socket = socketService.getSocket();
      if (!socket?.connected || !channelId) return;

      socket.emit('message:react', { messageId, emoji, channelId });
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

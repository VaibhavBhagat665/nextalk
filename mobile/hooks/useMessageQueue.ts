/**
 * React Hook for Message Queue Integration
 * 
 * Provides easy access to message queue functionality in React components
 */

import { useEffect, useState, useCallback } from 'react';
import { messageQueueService, QueuedMessage, MessageStatus } from '../lib/message-queue';

export function useMessageQueue(channelId: string) {
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);

  // Subscribe to queue updates for this channel
  useEffect(() => {
    // Get initial messages
    const initial = messageQueueService.getChannelMessages(channelId);
    setQueuedMessages(initial);

    // Subscribe to updates
    const unsubscribe = messageQueueService.subscribe(channelId, (message) => {
      setQueuedMessages(prev => {
        const existing = prev.find(m => m.id === message.id);
        
        if (existing) {
          // Update existing message
          return prev.map(m => m.id === message.id ? message : m);
        } else {
          // Add new message
          return [...prev, message].sort((a, b) => a.timestamp - b.timestamp);
        }
      });
    });

    return () => {
      unsubscribe();
    };
  }, [channelId]);

  // Enqueue a new message
  const enqueueMessage = useCallback(
    async (content: string, fileUrl?: string, fileType?: string) => {
      const message = await messageQueueService.enqueue({
        channelId,
        content,
        fileUrl,
        fileType,
        userId: '', // Will be set by the caller
        username: '', // Will be set by the caller
        imageUrl: '', // Will be set by the caller
      });

      return message;
    },
    [channelId]
  );

  // Retry a failed message
  const retryMessage = useCallback(async (messageId: string) => {
    await messageQueueService.retryMessage(messageId);
  }, []);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    await messageQueueService.deleteMessage(messageId);
  }, []);

  // Get message status
  const getMessageStatus = useCallback((messageId: string): MessageStatus | undefined => {
    const message = messageQueueService.getMessage(messageId);
    return message?.status;
  }, []);

  return {
    queuedMessages,
    enqueueMessage,
    retryMessage,
    deleteMessage,
    getMessageStatus,
  };
}

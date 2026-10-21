/**
 * Message Queue Service for Offline Support
 * 
 * Features:
 * - Queue outgoing messages when offline
 * - Retry with exponential backoff
 * - Persistent storage using AsyncStorage
 * - Message status tracking (pending, sending, sent, failed)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { socketService } from './socket';

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface QueuedMessage {
  id: string; // Temporary client-side ID
  channelId: string;
  content: string;
  fileUrl?: string;
  fileType?: string;
  userId: string;
  username: string;
  imageUrl?: string;
  timestamp: number;
  status: MessageStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: number;
  error?: string;
}

const STORAGE_KEY = '@nextalk:message_queue';
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 60 seconds

class MessageQueueService {
  private queue: Map<string, QueuedMessage> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Map<string, Set<(message: QueuedMessage) => void>> = new Map();
  private isProcessing = false;

  constructor() {
    this.loadQueue();
  }

  /**
   * Load persisted queue from AsyncStorage
   */
  private async loadQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const queueArray: QueuedMessage[] = JSON.parse(data);
        this.queue = new Map(queueArray.map(msg => [msg.id, msg]));
        console.log(`[MessageQueue] Loaded ${this.queue.size} messages from storage`);
        
        // Process any pending messages
        this.processPendingMessages();
      }
    } catch (error) {
      console.error('[MessageQueue] Failed to load queue:', error);
    }
  }

  /**
   * Persist queue to AsyncStorage
   */
  private async saveQueue(): Promise<void> {
    try {
      const queueArray = Array.from(this.queue.values());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queueArray));
    } catch (error) {
      console.error('[MessageQueue] Failed to save queue:', error);
    }
  }

  /**
   * Generate a temporary client-side message ID
   */
  private generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number): number {
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
    return Math.min(delay, MAX_RETRY_DELAY);
  }

  /**
   * Add a message to the queue
   */
  async enqueue(message: Omit<QueuedMessage, 'id' | 'status' | 'retryCount' | 'maxRetries' | 'timestamp'>): Promise<QueuedMessage> {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: this.generateTempId(),
      status: 'pending',
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      timestamp: Date.now(),
    };

    this.queue.set(queuedMessage.id, queuedMessage);
    await this.saveQueue();

    console.log(`[MessageQueue] Enqueued message ${queuedMessage.id}`);
    this.notifyListeners(queuedMessage);

    // Try to send immediately if online
    if (socketService.isConnected()) {
      this.sendMessage(queuedMessage.id);
    }

    return queuedMessage;
  }

  /**
   * Update message status
   */
  private async updateMessageStatus(
    id: string,
    status: MessageStatus,
    error?: string
  ): Promise<void> {
    const message = this.queue.get(id);
    if (!message) return;

    message.status = status;
    if (error) message.error = error;

    this.queue.set(id, message);
    await this.saveQueue();
    this.notifyListeners(message);
  }

  /**
   * Send a message via Socket.io
   */
  private async sendMessage(id: string): Promise<void> {
    const message = this.queue.get(id);
    if (!message) return;

    // Check if already sending or sent
    if (message.status === 'sending' || message.status === 'sent') {
      return;
    }

    // Check if max retries exceeded
    if (message.retryCount >= message.maxRetries) {
      await this.updateMessageStatus(id, 'failed', 'Max retries exceeded');
      return;
    }

    // Check if not connected
    const socket = socketService.getSocket();
    if (!socket || !socket.connected) {
      console.log(`[MessageQueue] Socket not connected, will retry ${id}`);
      this.scheduleRetry(id);
      return;
    }

    // Update status to sending
    await this.updateMessageStatus(id, 'sending');

    try {
      // Send message via Socket.io
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Send timeout'));
        }, 10000); // 10 second timeout

        socket.emit('message:send', {
          channelId: message.channelId,
          content: message.content,
          fileUrl: message.fileUrl,
          fileType: message.fileType,
        }, (response: any) => {
          clearTimeout(timeout);
          
          if (response?.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Send failed'));
          }
        });
      });

      // Success - mark as sent and remove from queue
      await this.updateMessageStatus(id, 'sent');
      
      // Remove from queue after a short delay (so UI can show "sent" state)
      setTimeout(() => {
        this.removeMessage(id);
      }, 2000);

      console.log(`[MessageQueue] Successfully sent message ${id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MessageQueue] Failed to send message ${id}:`, errorMessage);

      // Increment retry count
      message.retryCount++;
      
      // Schedule retry with exponential backoff
      this.scheduleRetry(id, errorMessage);
    }
  }

  /**
   * Schedule a retry with exponential backoff
   */
  private scheduleRetry(id: string, error?: string): void {
    const message = this.queue.get(id);
    if (!message) return;

    // Clear any existing retry timer
    const existingTimer = this.retryTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate delay
    const delay = this.calculateBackoffDelay(message.retryCount);
    message.nextRetryAt = Date.now() + delay;

    // Update status
    this.updateMessageStatus(id, 'pending', error);

    console.log(
      `[MessageQueue] Scheduling retry ${message.retryCount + 1}/${message.maxRetries} ` +
      `for ${id} in ${delay}ms`
    );

    // Schedule retry
    const timer = setTimeout(() => {
      this.retryTimers.delete(id);
      this.sendMessage(id);
    }, delay);

    this.retryTimers.set(id, timer);
  }

  /**
   * Remove a message from the queue
   */
  private async removeMessage(id: string): Promise<void> {
    this.queue.delete(id);
    
    const timer = this.retryTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(id);
    }

    await this.saveQueue();
  }

  /**
   * Process all pending messages
   */
  async processPendingMessages(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log(`[MessageQueue] Processing ${this.queue.size} pending messages`);

    for (const [id, message] of this.queue) {
      if (message.status === 'pending' || message.status === 'failed') {
        // Check if it's time to retry
        if (message.nextRetryAt && Date.now() < message.nextRetryAt) {
          const delay = message.nextRetryAt - Date.now();
          console.log(`[MessageQueue] Scheduling delayed retry for ${id} in ${delay}ms`);
          
          setTimeout(() => {
            this.sendMessage(id);
          }, delay);
        } else {
          // Send immediately
          this.sendMessage(id);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Retry a failed message manually
   */
  async retryMessage(id: string): Promise<void> {
    const message = this.queue.get(id);
    if (!message) return;

    // Reset retry count for manual retry
    message.retryCount = 0;
    delete message.nextRetryAt;
    
    await this.updateMessageStatus(id, 'pending');
    await this.sendMessage(id);
  }

  /**
   * Delete a message from the queue
   */
  async deleteMessage(id: string): Promise<void> {
    await this.removeMessage(id);
    
    // Notify listeners that message was deleted
    const message = this.queue.get(id);
    if (message) {
      this.notifyListeners({ ...message, status: 'failed' });
    }
  }

  /**
   * Get all messages for a channel
   */
  getChannelMessages(channelId: string): QueuedMessage[] {
    return Array.from(this.queue.values())
      .filter(msg => msg.channelId === channelId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get a specific message
   */
  getMessage(id: string): QueuedMessage | undefined {
    return this.queue.get(id);
  }

  /**
   * Subscribe to message status updates for a channel
   */
  subscribe(channelId: string, callback: (message: QueuedMessage) => void): () => void {
    if (!this.listeners.has(channelId)) {
      this.listeners.set(channelId, new Set());
    }
    
    this.listeners.get(channelId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(channelId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(channelId);
        }
      }
    };
  }

  /**
   * Notify listeners of message updates
   */
  private notifyListeners(message: QueuedMessage): void {
    const listeners = this.listeners.get(message.channelId);
    if (listeners) {
      listeners.forEach(callback => callback(message));
    }
  }

  /**
   * Clear all messages for a channel
   */
  async clearChannelQueue(channelId: string): Promise<void> {
    const messagesToDelete = Array.from(this.queue.values())
      .filter(msg => msg.channelId === channelId)
      .map(msg => msg.id);

    for (const id of messagesToDelete) {
      await this.removeMessage(id);
    }

    console.log(`[MessageQueue] Cleared ${messagesToDelete.length} messages for channel ${channelId}`);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    sending: number;
    sent: number;
    failed: number;
  } {
    const messages = Array.from(this.queue.values());
    
    return {
      total: messages.length,
      pending: messages.filter(m => m.status === 'pending').length,
      sending: messages.filter(m => m.status === 'sending').length,
      sent: messages.filter(m => m.status === 'sent').length,
      failed: messages.filter(m => m.status === 'failed').length,
    };
  }
}

export const messageQueueService = new MessageQueueService();

/**
 * Tests for Message Queue Service
 */

import { messageQueueService, QueuedMessage, MessageStatus } from '../message-queue';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock socket service
jest.mock('../socket', () => ({
  socketService: {
    isConnected: jest.fn(() => false),
    getSocket: jest.fn(() => null),
  },
}));

describe('MessageQueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should add a message to the queue with pending status', async () => {
      const message = await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'Test message',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      expect(message.status).toBe('pending');
      expect(message.content).toBe('Test message');
      expect(message.channelId).toBe('test-channel');
      expect(message.retryCount).toBe(0);
      expect(message.maxRetries).toBe(5);
    });

    it('should generate a unique temporary ID', async () => {
      const msg1 = await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'Message 1',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      const msg2 = await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'Message 2',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      expect(msg1.id).not.toBe(msg2.id);
      expect(msg1.id).toMatch(/^temp_/);
      expect(msg2.id).toMatch(/^temp_/);
    });
  });

  describe('getChannelMessages', () => {
    it('should return messages for a specific channel', async () => {
      await messageQueueService.enqueue({
        channelId: 'channel-1',
        content: 'Message for channel 1',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      await messageQueueService.enqueue({
        channelId: 'channel-2',
        content: 'Message for channel 2',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      const channel1Messages = messageQueueService.getChannelMessages('channel-1');
      const channel2Messages = messageQueueService.getChannelMessages('channel-2');

      expect(channel1Messages.length).toBe(1);
      expect(channel2Messages.length).toBe(1);
      expect(channel1Messages[0].content).toBe('Message for channel 1');
      expect(channel2Messages[0].content).toBe('Message for channel 2');
    });

    it('should return messages sorted by timestamp', async () => {
      // Add messages with slight delays
      const msg1 = await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'First',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const msg2 = await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'Second',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      const messages = messageQueueService.getChannelMessages('test-channel');

      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[0].timestamp).toBeLessThan(messages[1].timestamp);
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers when a message is enqueued', async () => {
      const callback = jest.fn();
      
      const unsubscribe = messageQueueService.subscribe('test-channel', callback);

      await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'Test message',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].content).toBe('Test message');

      unsubscribe();
    });

    it('should not notify unsubscribed callbacks', async () => {
      const callback = jest.fn();
      
      const unsubscribe = messageQueueService.subscribe('test-channel', callback);
      unsubscribe();

      await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'Test message',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should only notify subscribers of the correct channel', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      messageQueueService.subscribe('channel-1', callback1);
      messageQueueService.subscribe('channel-2', callback2);

      await messageQueueService.enqueue({
        channelId: 'channel-1',
        content: 'Message for channel 1',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'Message 1',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      await messageQueueService.enqueue({
        channelId: 'test-channel',
        content: 'Message 2',
        userId: 'user-1',
        username: 'TestUser',
        imageUrl: '',
      });

      const stats = messageQueueService.getStats();

      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.pending).toBeGreaterThanOrEqual(2);
      expect(stats.sending).toBe(0);
      expect(stats.sent).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });
});

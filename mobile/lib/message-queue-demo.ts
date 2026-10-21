/**
 * Message Queue Demo / Usage Examples
 * 
 * This file demonstrates how to use the message queue service
 * in different scenarios.
 */

import { messageQueueService, QueuedMessage } from './message-queue';

// ===== Example 1: Basic Usage =====
export async function example1_basicUsage() {
  console.log('=== Example 1: Basic Usage ===');
  
  // Enqueue a message
  const message = await messageQueueService.enqueue({
    channelId: 'channel-123',
    content: 'Hello, World!',
    userId: 'user-1',
    username: 'Alice',
    imageUrl: 'https://example.com/avatar.jpg',
  });
  
  console.log('Enqueued message:', message);
  console.log('Message ID:', message.id);
  console.log('Status:', message.status); // "pending"
}

// ===== Example 2: With File Attachment =====
export async function example2_withFile() {
  console.log('=== Example 2: With File Attachment ===');
  
  const message = await messageQueueService.enqueue({
    channelId: 'channel-123',
    content: 'Check out this image!',
    fileUrl: 'https://cloudinary.com/uploads/image123.jpg',
    fileType: 'image/jpeg',
    userId: 'user-1',
    username: 'Alice',
    imageUrl: 'https://example.com/avatar.jpg',
  });
  
  console.log('Message with file:', message);
}

// ===== Example 3: Subscribe to Updates =====
export function example3_subscribe() {
  console.log('=== Example 3: Subscribe to Updates ===');
  
  const unsubscribe = messageQueueService.subscribe('channel-123', (message) => {
    console.log('Message update:', {
      id: message.id,
      status: message.status,
      content: message.content.substring(0, 30) + '...',
      retryCount: message.retryCount,
    });
    
    // React to status changes
    if (message.status === 'sent') {
      console.log('✅ Message sent successfully!');
    } else if (message.status === 'failed') {
      console.log('❌ Message failed:', message.error);
    }
  });
  
  // Later: unsubscribe when done
  // unsubscribe();
  
  return unsubscribe;
}

// ===== Example 4: Get Channel Messages =====
export function example4_getMessages() {
  console.log('=== Example 4: Get Channel Messages ===');
  
  const messages = messageQueueService.getChannelMessages('channel-123');
  
  console.log(`Found ${messages.length} queued messages`);
  
  messages.forEach((msg, index) => {
    console.log(`${index + 1}. [${msg.status}] ${msg.content}`);
  });
}

// ===== Example 5: Manual Retry =====
export async function example5_manualRetry(messageId: string) {
  console.log('=== Example 5: Manual Retry ===');
  
  const message = messageQueueService.getMessage(messageId);
  
  if (!message) {
    console.log('Message not found');
    return;
  }
  
  console.log('Retrying message:', message.id);
  console.log('Previous retry count:', message.retryCount);
  
  await messageQueueService.retryMessage(messageId);
  
  console.log('Retry initiated');
}

// ===== Example 6: Delete Failed Message =====
export async function example6_deleteMessage(messageId: string) {
  console.log('=== Example 6: Delete Failed Message ===');
  
  const message = messageQueueService.getMessage(messageId);
  
  if (message && message.status === 'failed') {
    console.log('Deleting failed message:', message.id);
    await messageQueueService.deleteMessage(messageId);
    console.log('Message deleted');
  }
}

// ===== Example 7: Queue Statistics =====
export function example7_statistics() {
  console.log('=== Example 7: Queue Statistics ===');
  
  const stats = messageQueueService.getStats();
  
  console.log('Queue Statistics:');
  console.log('  Total:', stats.total);
  console.log('  Pending:', stats.pending);
  console.log('  Sending:', stats.sending);
  console.log('  Sent:', stats.sent);
  console.log('  Failed:', stats.failed);
}

// ===== Example 8: Process Pending Messages =====
export async function example8_processPending() {
  console.log('=== Example 8: Process Pending Messages ===');
  
  console.log('Processing all pending messages...');
  await messageQueueService.processPendingMessages();
  console.log('Processing complete');
}

// ===== Example 9: Clear Channel Queue =====
export async function example9_clearChannel(channelId: string) {
  console.log('=== Example 9: Clear Channel Queue ===');
  
  console.log('Clearing all messages for channel:', channelId);
  await messageQueueService.clearChannelQueue(channelId);
  console.log('Channel queue cleared');
}

// ===== Example 10: React Component Usage =====
export function example10_reactComponent() {
  console.log('=== Example 10: React Component Usage ===');
  
  const reactCode = `
import { useMessageQueue } from '../hooks/useMessageQueue';

function ChatScreen({ channelId }) {
  const {
    queuedMessages,
    enqueueMessage,
    retryMessage,
    deleteMessage,
  } = useMessageQueue(channelId);

  const sendMessage = async (content: string) => {
    await enqueueMessage(content);
  };

  const handleRetry = async (messageId: string) => {
    await retryMessage(messageId);
  };

  return (
    <View>
      {queuedMessages.map(msg => (
        <MessageBubble
          key={msg.id}
          content={msg.content}
          status={msg.status}
          onRetry={msg.status === 'failed' ? () => handleRetry(msg.id) : undefined}
        />
      ))}
    </View>
  );
}
  `;
  
  console.log(reactCode);
}

// ===== Run All Examples =====
export async function runAllExamples() {
  await example1_basicUsage();
  await example2_withFile();
  
  const unsubscribe = example3_subscribe();
  
  await example1_basicUsage(); // This will trigger the subscription
  
  example4_getMessages();
  example7_statistics();
  
  // Clean up
  unsubscribe();
  
  example10_reactComponent();
}

// ===== Offline Simulation Demo =====
export async function offlineSimulationDemo() {
  console.log('\n=== Offline Simulation Demo ===\n');
  
  // Subscribe to all updates
  const unsubscribe = messageQueueService.subscribe('demo-channel', (msg) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${msg.id.substr(0, 15)}... → ${msg.status.toUpperCase()}${msg.retryCount > 0 ? ` (retry ${msg.retryCount})` : ''}`);
    
    if (msg.status === 'failed') {
      console.log(`  ❌ Error: ${msg.error}`);
    }
  });
  
  // Simulate sending 3 messages while offline
  console.log('📱 Simulating offline message sends...\n');
  
  for (let i = 1; i <= 3; i++) {
    await messageQueueService.enqueue({
      channelId: 'demo-channel',
      content: `Offline message ${i}`,
      userId: 'demo-user',
      username: 'Demo User',
      imageUrl: '',
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Current queue state:');
  example7_statistics();
  
  console.log('\n🔄 Simulating connection restore...');
  console.log('(In production, this happens automatically when socket reconnects)\n');
  
  // In production, this would be called by socket.on('connect') or socket.on('reconnect')
  await messageQueueService.processPendingMessages();
  
  console.log('\n📊 Final queue state:');
  example7_statistics();
  
  unsubscribe();
}

# Task 63.2: Mobile Offline Message Queue Implementation

## Overview

Implemented a comprehensive offline-first message queue system for the mobile app that queues outgoing messages when offline and retries them with exponential backoff when connectivity is restored.

## Implementation Details

### 1. Message Queue Service (`lib/message-queue.ts`)

A persistent message queue service that handles:

- **Message Queuing**: Stores messages locally when they cannot be sent immediately
- **Exponential Backoff**: Retries failed messages with increasing delays (1s, 2s, 4s, 8s, 16s, up to 60s max)
- **Persistent Storage**: Uses AsyncStorage to survive app restarts
- **Status Tracking**: Tracks message states: `pending`, `sending`, `sent`, `failed`
- **Automatic Retry**: Automatically retries pending messages when connection is restored
- **Manual Retry**: Allows users to manually retry failed messages

#### Key Features:

```typescript
interface QueuedMessage {
  id: string;              // Temporary client-side ID
  channelId: string;       // Target channel
  content: string;         // Message content
  fileUrl?: string;        // Optional file attachment
  fileType?: string;       // File MIME type
  userId: string;          // Sender ID
  username: string;        // Sender username
  imageUrl?: string;       // Sender avatar
  timestamp: number;       // Creation timestamp
  status: MessageStatus;   // Current status
  retryCount: number;      // Number of retry attempts
  maxRetries: number;      // Maximum retry attempts (5)
  nextRetryAt?: number;    // Scheduled retry time
  error?: string;          // Error message for failed sends
}
```

#### Exponential Backoff Algorithm:

```
Retry 1: 1 second
Retry 2: 2 seconds
Retry 3: 4 seconds
Retry 4: 8 seconds
Retry 5: 16 seconds
Retry 6+: 60 seconds (capped)
```

### 2. React Hook (`hooks/useMessageQueue.ts`)

A custom React hook that provides easy integration with components:

```typescript
const {
  queuedMessages,      // List of queued messages for the channel
  enqueueMessage,      // Add a new message to the queue
  retryMessage,        // Manually retry a failed message
  deleteMessage,       // Remove a message from the queue
  getMessageStatus,    // Get the current status of a message
} = useMessageQueue(channelId);
```

### 3. Message Status Indicator Component (`components/ui/MessageStatusIndicator.tsx`)

Visual feedback for message states:

- **Pending/Sending**: Animated spinner
- **Sent**: Double checkmark icon
- **Failed**: Error icon with retry button

### 4. Socket Service Integration (`lib/socket.ts`)

Enhanced socket service to automatically process queued messages when connection is restored:

```typescript
socket.on('connect', () => {
  // Process any pending queued messages when connection is restored
  messageQueueService.processPendingMessages();
});

socket.on('reconnect', (attemptNumber) => {
  // Process queued messages after reconnection
  messageQueueService.processPendingMessages();
});
```

### 5. Chat Screen Integration (`app/(main)/chat/[channelId].tsx`)

Updated the chat screen to:

1. **Merge Messages**: Combine server messages with queued messages
2. **Show Status**: Display status indicators for outgoing messages
3. **Handle Retry**: Allow users to tap failed messages to retry
4. **Optimistic UI**: Clear input immediately after sending for better UX

```typescript
// Merge server messages with queued messages
const allMessages = React.useMemo(() => {
  const queuedAsMessages = queuedMessages.map(qm => ({
    id: qm.id,
    content: qm.content,
    userId: qm.userId,
    // ... other fields
    queuedMessage: qm, // Attach the queued message for status
  }));

  return [...messages, ...queuedAsMessages]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}, [messages, queuedMessages]);
```

## User Experience

### Sending Messages When Online

1. User types message and taps send
2. Message is added to queue with `pending` status
3. Queue service immediately attempts to send via Socket.io
4. Status changes to `sending` → `sent`
5. Message is removed from queue after 2 seconds

### Sending Messages When Offline

1. User types message and taps send
2. Message is added to queue with `pending` status
3. Queue service detects no connection
4. Message shows spinner indicator (sending/pending)
5. When connection is restored:
   - Queue automatically retries all pending messages
   - Status updates to `sending` → `sent`
   - Success indicators appear

### Failed Messages

1. If send fails after 5 retries:
   - Status changes to `failed`
   - Red error icon appears with retry button
   - Error message displayed
2. User can tap retry button to manually retry
3. Or delete the failed message

## Technical Highlights

### Exponential Backoff Implementation

```typescript
private calculateBackoffDelay(retryCount: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY);
}
```

### Persistent Storage

All messages are persisted to AsyncStorage:
- Survives app restarts
- Survives app backgrounding
- Automatically loaded on app start

### Race Condition Prevention

- Uses status checks to prevent duplicate sends
- Clears existing retry timers when scheduling new ones
- Validates socket connection before sending

### Memory Management

- Successfully sent messages are removed after 2 seconds
- Failed messages remain until user action
- Queue automatically cleaned up on success

## Testing

Created comprehensive unit tests in `lib/__tests__/message-queue.test.ts`:

- ✅ Message enqueueing
- ✅ Unique ID generation
- ✅ Channel filtering
- ✅ Message sorting
- ✅ Subscriber notifications
- ✅ Statistics tracking

## Files Created/Modified

### Created:
- `mobile/lib/message-queue.ts` - Core queue service
- `mobile/hooks/useMessageQueue.ts` - React hook
- `mobile/components/ui/MessageStatusIndicator.tsx` - Status UI component
- `mobile/lib/__tests__/message-queue.test.ts` - Unit tests
- `mobile/TASK_63.2_IMPLEMENTATION.md` - This documentation

### Modified:
- `mobile/lib/socket.ts` - Added queue processing on reconnect
- `mobile/app/(main)/chat/[channelId].tsx` - Integrated message queue

## Requirements Met

✅ **Requirement 7.12**: Mobile offline message queue with retry
- Messages queued when offline
- Exponential backoff retry (1s → 60s max)
- Visual status indicators (sending/sent/failed)
- Persistent across app restarts
- Manual retry for failed messages

## Future Enhancements

1. **Conflict Resolution**: Handle messages that fail due to channel being deleted
2. **Batch Sending**: Send multiple queued messages in parallel when online
3. **Network Quality Detection**: Adjust retry strategy based on connection quality
4. **Analytics**: Track retry success rates and failure reasons
5. **Message Expiry**: Auto-delete messages older than X days
6. **Background Sync**: Use background tasks for iOS/Android to sync when app is backgrounded

## Performance Considerations

- **Storage**: AsyncStorage is used for persistence (lightweight, fast)
- **Memory**: Only active channel's messages are rendered
- **Listeners**: Cleaned up automatically on unmount
- **Timers**: All retry timers are cleared on cleanup

## Edge Cases Handled

1. **App Restart**: Queue loaded from storage on startup
2. **Network Toggle**: Automatic retry when connection restored
3. **Channel Switch**: Each channel has independent queue
4. **Duplicate Prevention**: Temporary IDs prevent duplicate messages
5. **Max Retries**: Messages fail after 5 attempts to prevent infinite loops
6. **Socket Disconnect**: Messages queued if socket disconnects mid-send

## Validation: Requirement 7.12

**User Story**: As a mobile user, I want outgoing messages to be queued when offline and automatically sent when connection is restored, with clear status indicators.

**Acceptance Criteria**:
- ✅ Messages are queued when offline
- ✅ Retry with exponential backoff (1s, 2s, 4s, 8s, 16s, max 60s)
- ✅ Show visual states: sending (spinner), sent (checkmark), failed (error + retry)
- ✅ Persistent queue survives app restart
- ✅ Automatic processing when connection restored

**Status**: ✅ **Complete**

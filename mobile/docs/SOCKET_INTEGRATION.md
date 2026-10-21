# Mobile Socket.io Integration

## Overview

The mobile app implements Socket.io client with enhanced features for React Native, including automatic reconnection logic and background/foreground state management.

## Architecture

### SocketService (Singleton)
- **Location**: `mobile/lib/socket.ts`
- **Purpose**: Manages the Socket.io connection lifecycle
- **Features**:
  - Automatic reconnection with exponential backoff
  - App state awareness (background/foreground transitions)
  - Connection state tracking
  - Auth data caching for reconnection

### useSocket Hook
- **Location**: `mobile/hooks/useSocket.ts`
- **Purpose**: React hook for consuming Socket.io in components
- **Features**:
  - Message sending/receiving
  - Typing indicators
  - Message reactions
  - Online user presence
  - Optimistic updates

## Key Differences from Web Implementation

### 1. Background/Foreground Handling
Mobile apps need special handling for app state transitions:

```typescript
AppState.addEventListener('change', (nextAppState) => {
  if (appState.match(/inactive|background/) && nextAppState === 'active') {
    // App came to foreground - reconnect if needed
    this.attemptReconnect();
  }
});
```

### 2. WebSocket Transport Only
Mobile uses WebSocket-only transport for better performance:

```typescript
io(SOCKET_URL, {
  transports: ['websocket'], // No polling fallback on mobile
  // ...
});
```

### 3. Connection Persistence
Unlike web, the socket connection persists across route changes - it's only disconnected when explicitly requested or app is killed.

### 4. Reconnection Strategy
Mobile has more aggressive reconnection:
- Infinite reconnection attempts
- Custom reconnect timeout on app foreground
- Exponential backoff: 1s → 5s max

## Usage Example

```tsx
import { useSocket } from '../hooks/useSocket';

export default function ChatScreen({ channelId }: { channelId: string }) {
  const {
    messages,
    isConnected,
    sendMessage,
    startTyping,
    onlineUsers,
    typingUsers,
  } = useSocket(channelId);

  const handleSend = (content: string) => {
    sendMessage(content);
  };

  return (
    <View>
      {!isConnected && <Text>Reconnecting...</Text>}
      <MessageList messages={messages} />
      <MessageInput onSend={handleSend} onTyping={startTyping} />
    </View>
  );
}
```

## Connection Lifecycle

1. **App Launch**: User authenticates with Clerk → SocketService.connect() called
2. **Connected**: Socket established, presence updates received
3. **Channel Join**: User navigates to channel → channel:join emitted
4. **Background**: App backgrounded → connection maintained (iOS) or may disconnect (Android)
5. **Foreground**: App returns → auto-reconnect triggered if disconnected
6. **Channel Leave**: User navigates away → channel:leave emitted
7. **App Kill**: Socket disconnected automatically

## Error Handling

The implementation handles several error scenarios:

- **Network Loss**: Automatic reconnection with exponential backoff
- **Server Restart**: Reconnection with channel rejoin
- **Token Expiration**: User must re-authenticate (handled by Clerk)
- **Send Failures**: Messages shown as optimistic, replaced on confirmation

## Testing

To test the mobile Socket.io integration:

1. **Basic Connection**: Verify connection established on app launch
2. **Message Delivery**: Send messages and verify they appear in web app
3. **Background/Foreground**: Background app → foreground → verify reconnection
4. **Network Switch**: Switch WiFi/cellular → verify reconnection
5. **Server Restart**: Restart server → verify auto-reconnect

## Environment Variables

```env
EXPO_PUBLIC_SOCKET_URL=http://your-server-ip:3001
```

For development, use your machine's local IP address (not localhost).

## Requirements Validated

- ✅ **Requirement 7.1**: Mobile app connects to same Socket.io server as web
- ✅ Auto-reconnection logic with exponential backoff
- ✅ Background/foreground transition handling
- ✅ Same low-latency message delivery as web app

## Future Enhancements

- [ ] Push notifications when message received while app backgrounded
- [ ] Offline message queue (store and send when reconnected)
- [ ] Battery optimization (reduce reconnection frequency when battery low)
- [ ] Network type detection (WiFi vs cellular for quality adjustment)

# Redis Cross-Instance Message Delivery Test

## Purpose
Verify that messages sent to one Socket.io server instance are correctly delivered to clients connected to other instances via Redis pub/sub.

## Prerequisites
1. Redis instance running (Upstash or local)
2. `UPSTASH_REDIS_URL` environment variable configured in `.env`

## Running the Test

### Automated Test Script
```bash
npm run test:cross-instance
```

This script will:
1. Start two Socket.io server instances on ports 3101 and 3102
2. Connect three clients to different servers:
   - Client1 → Server 3101
   - Client2 → Server 3102  
   - Client3 → Server 3101
3. Send a message from Client1
4. Verify all clients receive the message via Redis pub/sub
5. Report test results with latency metrics

### Expected Output
```
✅ Cross-instance delivery: Client2 (server 3102) received message from Client1 (server 3101)
   Latency: ~50-200ms

✅ Same-instance delivery: Client3 (server 3101) received message from Client1
✅ Sender receives broadcast: Client1 received its own message

Summary: 3/3 tests passed
✅ All tests passed! Redis pub/sub is working correctly.
```

## Manual Testing (Alternative)

If automated test has issues, test manually:

### Terminal 1: Start Server Instance 1
```bash
set PORT=3101
npm run start:socket
```

### Terminal 2: Start Server Instance 2
```bash
set PORT=3102
npm run start:socket
```

### Terminal 3: Connect Client to Instance 1
```bash
node -e "const io = require('socket.io-client'); const s = io('http://localhost:3101'); s.on('connect', () => console.log('Connected to 3101')); s.on('message:new', (d) => console.log('Received:', d));"
```

### Terminal 4: Connect Client to Instance 2 and Send Message
```bash
node -e "const io = require('socket.io-client'); const s = io('http://localhost:3102'); s.on('connect', () => { console.log('Connected to 3102'); s.emit('message:send', {channelId: 'test', content: 'Cross-instance test'}); });"
```

### Expected Behavior
- Client in Terminal 3 (connected to 3101) should receive the message sent from Terminal 4 (connected to 3102)
- This confirms Redis pub/sub is working across instances

## Troubleshooting

### Test Fails: "Redis pub error" or "Redis sub error"
- Verify `UPSTASH_REDIS_URL` is correct in `.env`
- Check Redis instance is accessible
- Verify firewall rules allow Redis connection

### Test Fails: "Client2 did not receive message"
- Redis adapter may not be properly attached
- Check server logs for "✅ Redis adapter attached" message
- Verify both server instances connect to same Redis URL

### Ports Already in Use
- Change test ports in `server/test-cross-instance.ts`
- Or kill processes using ports 3101, 3102:
  ```bash
  netstat -ano | findstr :3101
  taskkill /PID <PID> /F
  ```

## What This Validates

✅ **Requirement 1.7**: Messages sent to one server instance are correctly delivered to clients connected to other instances via Redis pub/sub

✅ **Property 2**: Cross-Instance Message Delivery - "For any message sent to a client connected to Socket.io server instance A, all clients connected to server instances B and C should receive the message via Redis pub/sub fanout"

## Next Steps

After verifying cross-instance delivery works:
1. Move to Task 7: Docker Compose Multi-Instance Setup
2. Create production-ready multi-instance deployment
3. Run load tests against horizontally scaled setup

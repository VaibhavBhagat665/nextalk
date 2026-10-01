# mediasoup SFU Server

This directory contains the mediasoup SFU (Selective Forwarding Unit) implementation for NexTalk's WebRTC video/voice calls.

## Architecture

### Why SFU over Mesh?

**Mesh topology** (current P2P approach):
- Each participant connects to every other participant
- Requires N*(N-1)/2 connections for N participants
- Each client uploads N-1 streams
- **Breaks down at 5-6 participants** due to bandwidth/CPU constraints

**SFU topology** (this implementation):
- Centralized media server routes streams
- Each participant has 1 upload connection to SFU
- SFU forwards streams to other participants
- Scales to **12+ participants** easily

### Components

#### 1. Workers (`sfu-server.ts`)
- 1 worker per CPU core (max 4)
- Each worker handles multiple routers
- Round-robin distribution for load balancing

#### 2. Routers
- 1 router per voice/video room/channel
- Handles RTP packet routing for all participants in a room
- Supports multiple media codecs (Opus, VP8, VP9, H.264)

#### 3. Transports
- 2 transports per participant:
  - **Send transport**: Client → SFU (local media)
  - **Recv transport**: SFU → Client (remote media)
- WebRTC transports with ICE/DTLS

#### 4. Producers & Consumers
- **Producer**: Media source (participant's audio/video track)
- **Consumer**: Media sink (receiving another participant's track)
- For N participants, each has 1-2 producers and (N-1) consumers

## Signaling Flow

All signaling happens through Socket.io events:

### 1. Join Room
```typescript
socket.emit("sfu:join", { roomId }, (response) => {
  // response.rtpCapabilities - router capabilities
  // response.participants - existing participants
});
```

### 2. Create Transports
```typescript
// Send transport (for publishing local media)
socket.emit("sfu:createTransport", { roomId, direction: "send" }, (params) => {
  // params.id, iceParameters, iceCandidates, dtlsParameters
});

// Recv transport (for receiving remote media)
socket.emit("sfu:createTransport", { roomId, direction: "recv" }, (params) => {
  // params.id, iceParameters, iceCandidates, dtlsParameters
});
```

### 3. Connect Transports
```typescript
socket.emit("sfu:connectTransport", {
  roomId,
  transportId,
  dtlsParameters
}, (response) => {
  // response.success
});
```

### 4. Produce Media
```typescript
socket.emit("sfu:produce", {
  roomId,
  transportId,
  kind: "audio", // or "video"
  rtpParameters
}, (response) => {
  // response.producerId
});
```

### 5. Consume Media
```typescript
socket.emit("sfu:consume", {
  roomId,
  producerId, // from another participant
  rtpCapabilities
}, (response) => {
  // response.id, producerId, kind, rtpParameters
});
```

### 6. Leave Room
```typescript
socket.emit("sfu:leave", { roomId });
```

## Configuration

### Environment Variables

```bash
# mediasoup listen IP (default: 0.0.0.0)
MEDIASOUP_LISTEN_IP=0.0.0.0

# Announced IP (required for remote clients)
# Use your public IP or domain when deployed
MEDIASOUP_ANNOUNCED_IP=your-server-ip-or-domain

# Log level (debug, warn, error, none)
MEDIASOUP_LOG_LEVEL=warn

# RTC port range (ensure these ports are open in firewall)
# Default: 10000-10100
```

### Firewall Configuration

Open the following ports:
- **TCP/UDP 10000-10100**: RTC media ports
- **TCP 3001**: Socket.io signaling (if not behind proxy)

For production behind nginx:
- nginx handles port 443 (HTTPS)
- Forward WebSocket to Socket.io internally
- Ensure RTC ports are still directly accessible

## Room Lifecycle

1. **Room Creation**: Automatically created when first participant joins
2. **Participant Management**: Tracks all participants, transports, producers, consumers
3. **Auto Cleanup**: Room automatically closes when last participant leaves
4. **Disconnect Handling**: Cleans up resources when participant disconnects

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

Response includes SFU stats:
```json
{
  "status": "ok",
  "connections": 15,
  "sfu": {
    "workers": 4,
    "rooms": 3,
    "totalParticipants": 8
  }
}
```

### Logs

- `🚀 Starting N mediasoup workers...` - Workers initializing
- `✅ Worker N created (PID: ...)` - Worker ready
- `📦 Room created: {roomId}` - Room created
- `👤 Participant {name} added to room` - Participant joined
- `🔌 send/recv transport created` - Transport created
- `🎤 Producer created: audio/video` - Media production started
- `🔊 Consumer created` - Media consumption started
- `🗑️  Room closed: {roomId}` - Room cleanup

## Performance Targets

Based on the design document:

- **Participants**: 12+ with 720p@30fps video
- **Latency**: < 200ms end-to-end for media
- **CPU**: ~25% per participant at 720p (measured per core)
- **Bandwidth**: Server upload = sum of all participants' media

### Optimization Tips

1. **Enable Simulcast**: Send multiple quality layers, server selects best
2. **Pause Inactive Consumers**: Don't forward video for off-screen participants
3. **Audio Activity Detection**: Only forward audio from active speakers
4. **Adaptive Bitrate**: Adjust quality based on network conditions

## Deployment

### Local Development

The SFU runs automatically with the Socket.io server:

```bash
npm run dev  # Starts Next.js + Socket.io (includes SFU)
```

### Production (Docker)

See `docker-compose.yml` for multi-instance setup with nginx load balancer.

Key considerations:
- Set `MEDIASOUP_ANNOUNCED_IP` to your public IP/domain
- Open RTC port range (10000-10100) in firewall
- Use sticky sessions in load balancer for Socket.io
- Multiple Socket.io instances can share same mediasoup setup

## Topology Selection

Per the design, the system can use both topologies:

- **1:1 calls**: Optional P2P mesh (lower latency, no server load)
- **Group calls (3+ participants)**: SFU (required for scale)

This decision is made client-side based on participant count.

## References

- [mediasoup Documentation](https://mediasoup.org/documentation/v3/)
- [mediasoup Design Concepts](https://mediasoup.org/documentation/v3/mediasoup/design/)
- [WebRTC Topology Comparison](https://webrtcglossary.com/sfu/)

## Testing

Test the SFU with multiple clients:

1. Open multiple browser windows/tabs
2. Join the same voice/video channel
3. Check console logs for SFU signaling events
4. Monitor `/health` endpoint for SFU stats

For load testing, see `benchmarks/` directory.

# TURN Server Setup Guide

This document explains how to set up and use the coturn TURN server for NexTalk's WebRTC NAT traversal.

## What is a TURN Server?

**TURN (Traversal Using Relays around NAT)** is a protocol that helps WebRTC connections work even when clients are behind strict NATs or firewalls that block direct peer-to-peer connections.

### When Do You Need TURN?

- **5-10% of connections** typically require TURN relay when direct connections fail
- Common scenarios:
  - Symmetric NATs (common in corporate networks)
  - Restrictive firewalls
  - Mobile carriers with carrier-grade NAT (CGNAT)
  - VPN users

### How It Works

```
Without TURN (Direct Connection):
Client A ←──────────────────→ Client B
         (Direct P2P/UDP)

With TURN (Relayed Connection):
Client A ←→ TURN Server ←→ Client B
         (Relayed via server)
```

The TURN server acts as a relay, forwarding media packets between peers when direct connections fail.

## Quick Start (Docker)

### 1. Start TURN Server with Docker Compose

```bash
# Set your public IP (required for production)
export TURN_EXTERNAL_IP=your.public.ip.address

# Start all services including TURN server
docker-compose up -d

# Check TURN server logs
docker-compose logs -f turnserver
```

### 2. Configure Environment Variables

Add to your `.env.local`:

```bash
# For local development
NEXT_PUBLIC_TURN_URL=turn:localhost:3478
NEXT_PUBLIC_TURN_USERNAME=nextalk
NEXT_PUBLIC_TURN_CREDENTIAL=nextturn2024

# For production (set your public IP/domain)
TURN_EXTERNAL_IP=1.2.3.4
NEXT_PUBLIC_TURN_URL=turn:yourdomain.com:3478
```

### 3. Test TURN Server

Use the [Trickle ICE test page](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/):

1. Add your TURN server:
   - URI: `turn:localhost:3478`
   - Username: `nextalk`
   - Password: `nextturn2024`

2. Click "Gather candidates"

3. Look for `relay` candidates in the results (indicates TURN is working)

## Configuration

### Static Credentials (Development)

**File:** `docker/turnserver.conf`

```conf
user=nextalk:nextturn2024
```

⚠️ **Not secure for production!** Static credentials can be shared and reused.

### Time-Limited Credentials (Production)

For production, use time-limited credentials generated dynamically:

**1. Enable REST API authentication in `turnserver.conf`:**

```conf
use-auth-secret
static-auth-secret=YOUR_SHARED_SECRET_HERE
```

**2. Generate credentials on your server:**

```typescript
import crypto from 'crypto';

function generateTurnCredentials(username: string, secret: string, ttl: number = 86400) {
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const turnUsername = `${timestamp}:${username}`;
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(turnUsername);
  const turnPassword = hmac.digest('base64');
  
  return {
    username: turnUsername,
    password: turnPassword,
    ttl: ttl,
  };
}

// Usage
const creds = generateTurnCredentials('user123', 'YOUR_SHARED_SECRET_HERE', 86400);
// Pass creds to client via API
```

**3. Client uses temporary credentials:**

The credentials are only valid for the TTL period (e.g., 24 hours), then expire.

## Firewall Configuration

### Required Ports

Open these ports on your server firewall:

| Port | Protocol | Purpose |
|------|----------|---------|
| 3478 | UDP/TCP | STUN/TURN |
| 5349 | UDP/TCP | TURNS (TLS) |
| 49152-65535 | UDP | Relay connections |

### Example: UFW (Ubuntu)

```bash
# Allow TURN ports
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/udp
sudo ufw allow 5349/tcp

# Allow relay port range (limit for security)
sudo ufw allow 49152:49252/udp

# Reload firewall
sudo ufw reload
```

### Example: iptables

```bash
# TURN ports
iptables -A INPUT -p udp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
iptables -A INPUT -p udp --dport 5349 -j ACCEPT
iptables -A INPUT -p tcp --dport 5349 -j ACCEPT

# Relay port range
iptables -A INPUT -p udp --dport 49152:49252 -j ACCEPT

# Save rules
iptables-save > /etc/iptables/rules.v4
```

## Production Deployment

### 1. Set External IP

Your TURN server needs to know its public IP address:

```bash
# Method 1: Environment variable
export TURN_EXTERNAL_IP=1.2.3.4

# Method 2: Docker compose override
docker-compose up -d --build
```

### 2. Enable TLS (TURNS)

For secure connections, configure TLS certificates:

**a) Generate certificates (Let's Encrypt):**

```bash
sudo certbot certonly --standalone -d turn.yourdomain.com
```

**b) Update `turnserver.conf`:**

```conf
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
```

**c) Mount certificates in docker-compose:**

```yaml
volumes:
  - ./docker/turnserver.conf:/etc/coturn/turnserver.conf:ro
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

### 3. Use Time-Limited Credentials

Replace static credentials with REST API authentication (see above).

### 4. Monitor Performance

```bash
# View TURN server logs
docker-compose logs -f turnserver

# Check active connections
docker exec nextalk-turnserver turnserver --stats

# Monitor bandwidth usage
docker stats nextalk-turnserver
```

## Resource Requirements

### Bandwidth

- Each relayed connection: ~100-500 KB/s (depending on video quality)
- 100 concurrent calls: ~10-50 MB/s = ~10-50 Mbps

### CPU & Memory

- CPU: ~0.1 core per 10 concurrent connections
- Memory: ~50-100 MB base + ~1 MB per connection

### Scaling

For high traffic, deploy multiple TURN servers:

```
Geographic Distribution:
- turn-us.yourdomain.com (US East)
- turn-eu.yourdomain.com (Europe)
- turn-asia.yourdomain.com (Asia)

Route clients to nearest server for lowest latency
```

## Troubleshooting

### TURN Server Not Starting

**Check logs:**
```bash
docker-compose logs turnserver
```

**Common issues:**
- Port already in use: Change ports in `docker-compose.yml`
- Config file syntax: Validate `turnserver.conf`
- Permissions: Ensure config file is readable

### Clients Not Using TURN

**Check ICE candidates:**

In browser console, examine WebRTC connection:
```javascript
pc.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('ICE candidate:', event.candidate.type, event.candidate.candidate);
  }
};
```

Look for `relay` type candidates. If missing:
- TURN credentials are wrong
- TURN server is unreachable
- Firewall blocking ports

### High Latency

TURN relay adds ~50-100ms latency due to additional hop:

```
Direct P2P:    Client A ←→ Client B        (10-50ms)
TURN Relay:    Client A ←→ TURN ←→ Client B (60-150ms)
```

**Solutions:**
- Deploy TURN servers closer to users
- Use multiple geographic regions
- Optimize network routing

### High Bandwidth Usage

If TURN relay is being used too often:

1. **Check NAT situation:** Most users should connect directly
2. **Enable STUN:** Ensure STUN is working for NAT discovery
3. **Network diagnostics:** Use webrtc-internals to debug connection attempts

## Testing & Validation

### 1. Basic Connectivity Test

```bash
# Test TURN server is listening
nc -zu localhost 3478
# Should return: Connection to localhost 3478 port [udp/*] succeeded!
```

### 2. STUN/TURN Test Tool

Use [webrtc.github.io/samples](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/):

- Enter TURN URL: `turn:localhost:3478`
- Enter username: `nextalk`
- Enter password: `nextturn2024`
- Click "Gather candidates"
- Verify `relay` candidates appear

### 3. Load Testing

Simulate multiple connections:

```javascript
// Load test: create 100 relay connections
const turnConfig = {
  iceServers: [
    {
      urls: 'turn:localhost:3478',
      username: 'nextalk',
      credential: 'nextturn2024',
    },
  ],
};

const peers = [];
for (let i = 0; i < 100; i++) {
  const pc = new RTCPeerConnection(turnConfig);
  peers.push(pc);
  // ... establish connections
}
```

## Cost Estimation

### Self-Hosted (VPS)

- **Small VPS** (2 vCPU, 4GB RAM): ~$20-40/month
  - Supports ~50 concurrent relay connections
  - ~5 Mbps average bandwidth

- **Medium VPS** (4 vCPU, 8GB RAM): ~$80-120/month
  - Supports ~200 concurrent relay connections
  - ~20 Mbps average bandwidth

### Managed Services

- **Twilio TURN**: $0.0004/min/participant
  - 100 users × 30 min/day × 30 days = $36/month

- **Xirsys**: $29-199/month
  - Unlimited TURN relay
  - Multiple geographic regions

## Alternative: Using Twilio TURN

If you prefer a managed service:

```bash
# .env.local
NEXT_PUBLIC_TURN_URL=turn:global.turn.twilio.com:3478?transport=udp
NEXT_PUBLIC_TURN_USERNAME=your_twilio_username
NEXT_PUBLIC_TURN_CREDENTIAL=your_twilio_credential
```

Get credentials from [Twilio Console](https://www.twilio.com/docs/stun-turn).

## References

- [coturn GitHub](https://github.com/coturn/coturn)
- [RFC 5766 - TURN](https://tools.ietf.org/html/rfc5766)
- [WebRTC samples - Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
- [Twilio TURN](https://www.twilio.com/docs/stun-turn)

---

**Need Help?**

- Check Docker logs: `docker-compose logs turnserver`
- Validate config: Copy `turnserver.conf` and test locally
- Test connectivity: Use webrtc.github.io test tools

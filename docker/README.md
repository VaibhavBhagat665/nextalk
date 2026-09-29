# Docker Horizontal Scaling Setup

**Task:** 7. Docker Compose Multi-Instance Setup ✅  
**Requirements:** 1.8

---

## Overview

This directory contains Docker configuration for testing NexTalk's horizontal scaling capabilities with multiple Socket.io instances behind an nginx load balancer.

## Architecture

```
                 ┌─────────────┐
                 │   Client    │
                 └──────┬──────┘
                        │
                        ▼
                 ┌─────────────┐
                 │    nginx    │
                 │   (Port 80) │
                 │  ip_hash LB │
                 └──────┬──────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌────────┐      ┌────────┐      ┌────────┐
   │ Socket │      │ Socket │      │ Socket │
   │ Server │      │ Server │      │ Server │
   │   #1   │      │   #2   │      │   #3   │
   └────┬───┘      └────┬───┘      └────┬───┘
        └────────────┬───┴────────────┘
                     │
                     ▼
              ┌─────────────┐
              │    Redis    │
              │   Pub/Sub   │
              └─────────────┘
```

## Files

- `../docker-compose.yml` - Multi-service orchestration
- `../server/Dockerfile` - Socket.io server image
- `../nginx/nginx.conf` - Load balancer configuration

## Quick Start

### 1. Prerequisites
- Docker installed
- Docker Compose installed
- `.env` file with required variables

### 2. Start Services
```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 3. Test Connection
```bash
# Test health endpoint
curl http://localhost:8080/health

# Test metrics
curl http://localhost:8080/metrics
```

### 4. Connect Client
Update your client to connect to nginx:
```javascript
const socket = io('http://localhost:8080');
```

### 5. Verify Cross-Instance Messaging
```bash
# Watch logs to see which instance each client connects to
docker-compose logs -f | grep "Client connected"

# You should see messages being delivered across instances via Redis
```

## Environment Variables

Create a `.env` file in project root:

```bash
# Database (required)
DATABASE_URL=postgresql://user:pass@host:5432/nextalk

# Redis (optional - will use docker redis by default)
# UPSTASH_REDIS_URL=rediss://...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Service Ports

- **nginx Load Balancer:** 8080 → 80 (internal)
- **Redis:** 6379 (exposed for debugging)
- **Socket.io instances:** Internal only (3001)

## Common Commands

### Development
```bash
# Start services
docker-compose up -d

# Rebuild after code changes
docker-compose up -d --build

# View logs for specific service
docker-compose logs -f socket-server-1

# Restart a service
docker-compose restart socket-server-1

# Stop all services
docker-compose down
```

### Testing
```bash
# Test nginx configuration
docker-compose exec nginx nginx -t

# Reload nginx (zero downtime)
docker-compose exec nginx nginx -s reload

# Connect to Redis CLI
docker-compose exec redis redis-cli

# Check Redis pub/sub
docker-compose exec redis redis-cli PUBSUB CHANNELS
```

### Monitoring
```bash
# Resource usage
docker stats

# Container health
docker-compose ps

# View all logs
docker-compose logs --tail=100 -f
```

### Cleanup
```bash
# Stop and remove containers
docker-compose down

# Remove volumes too
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Scaling

To test with more instances:

```yaml
# Add to docker-compose.yml
socket-server-4:
  # ... same config as socket-server-1
  container_name: nextalk-socket-4
  environment:
    - INSTANCE_ID=socket-4
```

Update nginx upstream:
```nginx
upstream socket_backend {
    ip_hash;
    server socket-server-1:3001;
    server socket-server-2:3001;
    server socket-server-3:3001;
    server socket-server-4:3001;  # Add new instance
}
```

Then:
```bash
docker-compose up -d --build
```

## Load Testing

See `../benchmarks/load-test.js` for k6/Artillery load testing against the multi-instance setup:

```bash
# Run load test
k6 run benchmarks/load-test.js
```

## Troubleshooting

### Service won't start
```bash
# Check logs for errors
docker-compose logs socket-server-1

# Common issues:
# - DATABASE_URL not set
# - Redis connection failed
# - Port already in use
```

### Clients can't connect
```bash
# Verify nginx is running
docker-compose ps nginx

# Test nginx config
docker-compose exec nginx nginx -t

# Check nginx logs
docker-compose logs nginx
```

### Messages not crossing instances
```bash
# Check Redis is healthy
docker-compose exec redis redis-cli PING

# Verify Redis adapter is working
docker-compose logs | grep "Redis adapter attached"

# Check pub/sub channels
docker-compose exec redis redis-cli PUBSUB CHANNELS
```

### High memory usage
```bash
# Check resource usage
docker stats

# Limit container memory in docker-compose.yml:
services:
  socket-server-1:
    deploy:
      resources:
        limits:
          memory: 512M
```

## Performance Tips

1. **Use Redis Locally:** For testing, use the containerized Redis. For production, use Upstash or managed Redis.

2. **Optimize nginx:** Tune `worker_connections` based on expected load.

3. **Monitor Health:** Use `/health` and `/metrics` endpoints for monitoring.

4. **Sticky Sessions:** ip_hash ensures WebSocket persistence but may cause uneven distribution with few clients.

5. **Connection Pool:** Ensure Socket.io connection limits match your load tests.

## Production Deployment

For production, consider:

1. **Managed Services:** Use managed Redis (Upstash), managed Kubernetes (EKS/GKE), or serverless (Vercel + Railway).

2. **TLS/SSL:** Add SSL termination at nginx or use Cloudflare.

3. **Monitoring:** Integrate Prometheus/Grafana for metrics collection.

4. **Auto-scaling:** Use Kubernetes HPA or Docker Swarm for auto-scaling based on load.

5. **Health Checks:** Configure proper liveness and readiness probes.

6. **Secrets Management:** Use Docker secrets or Kubernetes secrets for sensitive env vars.

## Next Steps

1. ✅ Docker setup complete
2. ⏳ Run load tests (Task 8)
3. ⏳ Measure cross-instance latency
4. ⏳ Document results in benchmarks/realtime.md
5. ⏳ Compare single vs multi-instance performance

---

**Status:** ✅ Docker configuration complete and ready for testing

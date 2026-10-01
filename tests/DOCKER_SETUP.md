# Docker Setup for Cross-Instance Testing

## Overview

This guide explains how to set up and run the multi-instance Socket.io environment for testing cross-instance message delivery via Redis pub/sub.

## Prerequisites

1. **Docker Desktop** installed and running
   - Windows: Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - Ensure Docker Desktop is running (check system tray)

2. **Environment Variables**
   - Create a `.env` file in the project root with your database URL:
     ```
     DATABASE_URL="your-supabase-database-url"
     NEXT_PUBLIC_APP_URL="http://localhost:3000"
     ```

## Quick Start

### 1. Start Docker Desktop
Make sure Docker Desktop is running. You should see the Docker icon in your system tray.

### 2. Build and Start Services
```bash
docker-compose up -d --build
```

This starts:
- 3 Socket.io server instances (ports 3001, 3002, 3003)
- 1 Redis server (port 6379)
- 1 nginx load balancer (port 8080)

### 3. Check Services are Healthy
```bash
docker-compose ps
```

All services should show "Up" or "healthy" status.

### 4. View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f socket-server-1

# Check for Redis adapter attachment
docker-compose logs | grep "Redis adapter attached"
```

You should see "✅ Redis adapter attached" from all 3 Socket.io instances.

### 5. Run the Test
```bash
npm run test:cross-instance
```

### 6. Stop Services
```bash
docker-compose down
```

## Detailed Setup

### Service Architecture

```
                    nginx (port 8080)
                    |
        +-----------+-----------+
        |           |           |
    Socket.io   Socket.io   Socket.io
    Instance1   Instance2   Instance3
    (port 3001) (port 3002) (port 3003)
        |           |           |
        +-----------+-----------+
                    |
                Redis (port 6379)
```

### Environment Variables

The Docker Compose setup uses these environment variables:

- `DATABASE_URL`: PostgreSQL connection string (required)
- `NEXT_PUBLIC_APP_URL`: Your Next.js app URL (defaults to http://localhost:3000)
- `UPSTASH_REDIS_URL`: Set automatically to `redis://redis:6379` in containers

### Port Mapping

| Service | Container Port | Host Port | Description |
|---------|---------------|-----------|-------------|
| socket-server-1 | 3001 | Not exposed | Socket.io instance 1 |
| socket-server-2 | 3001 | Not exposed | Socket.io instance 2 |
| socket-server-3 | 3001 | Not exposed | Socket.io instance 3 |
| redis | 6379 | 6379 | Redis pub/sub |
| nginx | 80 | 8080 | Load balancer |

### Health Checks

All services have health checks configured:

**Socket.io instances:**
- Endpoint: `GET /health`
- Interval: 30 seconds
- Returns connection count and Redis status

**Redis:**
- Command: `redis-cli ping`
- Interval: 10 seconds

**nginx:**
- Command: `wget http://localhost/health`
- Interval: 10 seconds

## Testing Methods

### Method 1: Direct Instance Connections

Connect clients directly to each Socket.io instance:

```bash
# Terminal 1: Start services
docker-compose up

# Terminal 2: Run test
npm run test:cross-instance
```

The test will:
1. Create 3 clients, each connected to a different instance
2. Have each client send messages
3. Verify all messages are delivered to all clients via Redis pub/sub

### Method 2: nginx Load Balancer

Connect clients through nginx, which distributes them across instances:

```bash
# Same setup as Method 1
# Test automatically includes nginx testing
npm run test:cross-instance
```

The test will:
1. Create 5 clients through nginx
2. nginx distributes them with sticky sessions
3. Messages are fanned out via Redis pub/sub
4. Verify all clients receive all messages

### Method 3: Manual Testing

1. **Start services:**
   ```bash
   docker-compose up
   ```

2. **Open your browser:**
   - Window 1: http://localhost:3000
   - Window 2: http://localhost:3000
   - Window 3: http://localhost:3000

3. **Check which instance each client connected to:**
   ```bash
   docker-compose logs | grep "Client connected"
   ```

4. **Send messages:**
   - Type in any window
   - Messages should appear in all windows
   - Even if clients are on different instances

## Troubleshooting

### Docker Desktop Not Running

**Error:** `error during connect: ... The system cannot find the file specified`

**Solution:** Start Docker Desktop from the Start menu or desktop shortcut.

### Port Already in Use

**Error:** `Bind for 0.0.0.0:8080 failed: port is already allocated`

**Solution:**
1. Find what's using the port:
   ```bash
   netstat -ano | findstr :8080
   ```
2. Kill the process or change the port in `docker-compose.yml`

### DATABASE_URL Warning

**Warning:** `The "DATABASE_URL" variable is not set`

**Solution:** Create a `.env` file in the project root:
```
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
```

### Redis Connection Failed

**Error:** `Redis connection failed` in logs

**Solution:**
1. Check Redis container is running:
   ```bash
   docker-compose ps redis
   ```

2. Check Redis logs:
   ```bash
   docker-compose logs redis
   ```

3. Restart Redis:
   ```bash
   docker-compose restart redis
   ```

### Services Won't Start

**Solution:**
1. Clean up old containers:
   ```bash
   docker-compose down -v
   ```

2. Rebuild:
   ```bash
   docker-compose up -d --build
   ```

3. Check logs for specific errors:
   ```bash
   docker-compose logs
   ```

### Test Fails: Messages Not Delivered

**Possible causes:**

1. **Redis adapter not attached:**
   ```bash
   docker-compose logs | grep "Redis adapter"
   ```
   Should see 3 "✅ Redis adapter attached" messages.

2. **Clients not joining channel:**
   Add membership to test channel in database first.

3. **Rate limiting:**
   Test sends too many messages too fast (max 10/10s).
   Increase delays in test code.

4. **Network timing:**
   Increase wait times in test:
   ```typescript
   // In cross-instance-test.ts
   await new Promise((resolve) => setTimeout(resolve, 5000)); // Increase this
   ```

## Verifying Redis Pub/Sub

### Check Redis is receiving messages:

```bash
# Terminal 1: Subscribe to Redis pub/sub
docker exec -it nextalk-redis redis-cli
> PSUBSCRIBE *

# Terminal 2: Send a message through the app
# You should see pub/sub events in Terminal 1
```

### Check Redis keys:

```bash
docker exec -it nextalk-redis redis-cli
> KEYS *
> SUBSCRIBE *
```

## Performance Monitoring

### Check resource usage:

```bash
docker stats
```

### Check Socket.io metrics:

```bash
curl http://localhost:8080/metrics
```

Returns Prometheus-format metrics including:
- Connection count
- Message latency (p50/p95/p99)
- Redis status

### Check individual instance health:

Since instances aren't exposed directly, use nginx:
```bash
curl http://localhost:8080/health
```

## Clean Up

### Stop services:
```bash
docker-compose down
```

### Stop and remove volumes:
```bash
docker-compose down -v
```

### Remove all images:
```bash
docker-compose down --rmi all -v
```

### Remove orphaned containers:
```bash
docker system prune -a
```

## Production Deployment

For production, you would:

1. **Use a managed Redis**: Upstash, AWS ElastiCache, etc.
2. **Use environment-specific URLs**: Update `UPSTASH_REDIS_URL`
3. **Use proper secrets management**: Not `.env` files
4. **Scale with orchestration**: Kubernetes, ECS, etc.
5. **Add monitoring**: Grafana, Datadog, etc.
6. **Use SSL/TLS**: For all connections

Example production-like setup:
```bash
# Set production Redis URL
export UPSTASH_REDIS_URL="rediss://default:password@your-redis.upstash.io:6379"

# Build and deploy
docker-compose up -d --build
```

## Next Steps

After successful cross-instance testing:

1. **Load Testing**: Run k6 load tests against multi-instance setup
2. **Latency Measurement**: Compare single vs multi-instance latency
3. **Scaling Tests**: Try with more instances (4, 5, 6...)
4. **Documentation**: Update `benchmarks/realtime.md` with results
5. **Production Deploy**: Deploy to actual cloud infrastructure

## Related Documentation

- `tests/README.md` - Test documentation
- `benchmarks/realtime.md` - Performance benchmarks
- `nginx/nginx.conf` - nginx configuration
- `server/Dockerfile` - Socket.io server Docker image
- `docker-compose.yml` - Service orchestration

## Support

If you encounter issues:

1. Check Docker Desktop is running
2. Check all services are healthy: `docker-compose ps`
3. Check logs for errors: `docker-compose logs`
4. Try restarting: `docker-compose restart`
5. Try rebuilding: `docker-compose up -d --build`
6. Try clean start: `docker-compose down -v && docker-compose up -d --build`

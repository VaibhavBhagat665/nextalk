# Cross-Instance Message Delivery Test

This test validates **Property 2: Cross-Instance Message Delivery** from the design specification.

## What It Tests

Verifies that messages sent to clients connected to one Socket.io server instance are correctly delivered to clients connected to other instances via Redis pub/sub fanout.

## Prerequisites

1. **Docker and Docker Compose** installed
2. **All services running**:
   ```bash
   docker-compose up -d
   ```

3. **Services healthy**:
   ```bash
   docker-compose ps
   ```
   
   All services should show "healthy" status.

## Running the Test

### Quick Test
```bash
npm run test:cross-instance
```

### Manual Test Steps

1. **Start all services**:
   ```bash
   docker-compose up -d
   ```

2. **Wait for services to be ready** (check logs):
   ```bash
   docker-compose logs -f | grep "Redis adapter attached"
   ```
   
   You should see this message from all 3 Socket.io instances.

3. **Run the test**:
   ```bash
   npm run test:cross-instance
   ```

4. **Check the output**:
   - Test 1: Direct instance connections
   - Test 2: nginx load balancer connections

## What Success Looks Like

```
============================================================
TEST SUMMARY
============================================================

Tests passed: 2/2

🎉 ALL TESTS PASSED

Property 2 validated: Cross-instance message delivery works correctly.
Messages are successfully fanned out via Redis pub/sub.
```

## Test Details

### Test 1: Direct Instance Connections
- Creates 3 clients, each connected to a different Socket.io instance
- Each client sends 2 messages
- Verifies all 6 messages are delivered to all 3 clients
- **Validates**: Redis pub/sub fanout across instances

### Test 2: nginx Load Balancer
- Creates 5 clients through nginx load balancer
- nginx distributes them across instances with sticky sessions
- Each client sends 2 messages
- Verifies all 10 messages are delivered to all 5 clients
- **Validates**: Sticky sessions + Redis pub/sub work together

## Troubleshooting

### "Connection refused" errors
- Check that all Docker containers are running:
  ```bash
  docker-compose ps
  ```
- Check that ports are not blocked by firewall
- Ensure no other services are using ports 3001-3003, 6379, 8080

### "Redis adapter not attached" in logs
- Check Redis is running:
  ```bash
  docker-compose logs redis
  ```
- Check Redis connection from Socket.io instances:
  ```bash
  docker-compose logs socket-server-1 | grep Redis
  ```

### Some messages not delivered
- Check that all 3 Socket.io instances show "Redis adapter attached"
- Check for errors in instance logs:
  ```bash
  docker-compose logs socket-server-1
  docker-compose logs socket-server-2  
  docker-compose logs socket-server-3
  ```
- Verify Redis pub/sub is working:
  ```bash
  docker exec -it nextalk-redis redis-cli
  > SUBSCRIBE *
  ```
  (In another terminal, send a test message and watch for pub/sub events)

### Test hangs or times out
- Increase wait times in the test code if running on slow hardware
- Check that clients are successfully joining channels (look for "joined channel" logs)
- Verify no rate limiting is triggered (max 10 messages per 10 seconds)

## Architecture Validated

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Client1 │      │ Client2 │      │ Client3 │
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     │                │                │
     ▼                ▼                ▼
┌─────────┐      ┌─────────┐      ┌─────────┐
│Socket.io│      │Socket.io│      │Socket.io│
│Instance1│      │Instance2│      │Instance3│
└────┬────┘      └────┬────┘      └────┬────┘
     │                │                │
     └────────────────┼────────────────┘
                      │
                      ▼
                ┌──────────┐
                │  Redis   │
                │ Pub/Sub  │
                └──────────┘
```

When Client1 sends a message to Instance1:
1. Instance1 publishes to Redis
2. Redis fans out to all instances
3. Instance2 and Instance3 receive via subscription
4. Client2 and Client3 receive the message

## Clean Up

Stop all services:
```bash
docker-compose down
```

Stop and remove volumes:
```bash
docker-compose down -v
```

## Related Files

- `docker-compose.yml` - Multi-instance setup
- `nginx/nginx.conf` - Load balancer configuration
- `server/socket-server.ts` - Redis adapter setup
- `.kiro/specs/nextalk-production-upgrade/design.md` - Property 2 definition

## Requirements Validated

- **Requirement 1.7**: Messages sent to one instance are delivered to clients on other instances
- **Property 2**: Cross-Instance Message Delivery

## Next Steps

After this test passes, you can:
1. Run load tests against the multi-instance setup
2. Measure latency overhead of Redis pub/sub
3. Document results in `benchmarks/realtime.md`

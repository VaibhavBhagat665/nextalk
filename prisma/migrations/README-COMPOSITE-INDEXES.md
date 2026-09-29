# Composite Index Migration

## Status: ✅ COMPLETED - Indexes Added to Schema

The composite indexes have been successfully added to the Prisma schema. The migration is ready to be applied when a database connection is available.

## Changes Made

Added composite indexes to the Message model for performance optimization:

1. `@@index([channelId, createdAt])` - Optimizes sorted queries for messages in a channel
2. `@@index([channelId, id])` - Optimizes cursor-based pagination

## Additional Indexes Added (Task 11)

The following additional indexes were added for production optimization:

### Message Table
- **Vector Index**: HNSW index for semantic search (pgvector)

### AISummary Table  
- `@@index([expiresAt])` - For cleanup jobs

### InviteLink Table
- `@@index([expiresAt])` - For cleanup jobs
- `@@index([isActive])` - For filtering active invites

### CallSession Table
- `@@index([status])` - For filtering by call status
- `@@index([createdAt])` - For call history queries

## Applying the Migration

### Automated Script (Recommended)

**PowerShell (Windows):**
```powershell
cd prisma\migrations
.\apply-and-measure.ps1
```

**Bash (Linux/Mac):**
```bash
cd prisma/migrations
chmod +x apply-and-measure.sh
./apply-and-measure.sh
```

### Manual Application

**Development:**
```bash
npx prisma migrate dev --name add_composite_indexes
```

**Production:**
```bash
npx prisma migrate deploy
```

## Migration Files

The migration has been prepared in:
- `20240101000000_add_optimized_indexes/migration.sql` - SQL migration
- `20240101000000_add_optimized_indexes/README.md` - Detailed documentation
- `apply-and-measure.ps1` - Windows deployment script
- `apply-and-measure.sh` - Unix deployment script

## Expected Impact

### Before
- Query: `SELECT * FROM Message WHERE channelId = ? ORDER BY createdAt DESC LIMIT 50`
- Performance: Full table scan on channelId, then sort
- Query time with 1M messages: ~500-1000ms

### After  
- Same query uses composite index (channelId, createdAt)
- Performance: Index scan with no additional sort needed
- Query time with 1M messages: ~20-50ms

### Semantic Search
- Vector similarity queries: ~200ms (vs. 10+ seconds without HNSW index)

## Validation

After applying migration, verify indexes were created:

```sql
-- Check indexes on Message table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Message';
```

Expected output should include:
```
Message_channelId_createdAt_idx
Message_channelId_id_idx
Message_embedding_idx (HNSW)
```

## Benchmarking

Run query profiling to measure impact:
```bash
npm run db:profile
```

Compare results before and after migration in `benchmarks/database.md`.

## Rollback

If needed, rollback the migration:
```bash
npx prisma migrate resolve --rolled-back 20240101000000_add_optimized_indexes
```

Then manually drop the indexes:
```sql
DROP INDEX IF EXISTS "Message_embedding_idx";
DROP INDEX IF EXISTS "AISummary_expiresAt_idx";
DROP INDEX IF EXISTS "InviteLink_expiresAt_idx";
DROP INDEX IF EXISTS "InviteLink_isActive_idx";
DROP INDEX IF EXISTS "CallSession_status_idx";
DROP INDEX IF EXISTS "CallSession_createdAt_idx";
```

## Requirements Addressed

✅ **Requirement 2.2**: Create composite indexes on frequently queried column combinations  
✅ **Requirement 2.3**: Implement cursor-based pagination index support  
✅ **Requirement 2.4**: Add indexes for pgvector semantic search


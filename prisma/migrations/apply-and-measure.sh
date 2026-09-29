#!/bin/bash
# Script to apply migration and measure impact
# Usage: ./apply-and-measure.sh

set -e

echo "=========================================="
echo "Database Index Optimization Migration"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Please set DATABASE_URL before running this script"
    exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Verify pgvector extension exists
echo "→ Checking pgvector extension..."
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ pgvector extension enabled"
else
    echo "❌ Failed to enable pgvector extension"
    exit 1
fi
echo ""

# Count messages before migration
echo "→ Checking message count..."
MESSAGE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"Message\";" | xargs)
echo "✓ Current message count: $MESSAGE_COUNT"

if [ "$MESSAGE_COUNT" -lt 100000 ]; then
    echo "⚠️  WARNING: Message count is low ($MESSAGE_COUNT)"
    echo "   For meaningful performance testing, seed at least 1M messages (Task 10)"
fi
echo ""

# Record start time
START_TIME=$(date +%s)

# Apply migration
echo "→ Applying migration..."
echo "   This may take 5-10 minutes for large tables..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
    echo "❌ Migration failed"
    exit 1
fi

# Record end time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "✓ Migration applied successfully"
echo "  Duration: ${DURATION} seconds"
echo ""

# Verify indexes were created
echo "→ Verifying indexes..."
INDEX_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname IN (
        'Message_embedding_idx',
        'AISummary_expiresAt_idx',
        'InviteLink_expiresAt_idx',
        'InviteLink_isActive_idx',
        'CallSession_status_idx',
        'CallSession_createdAt_idx'
    );
" | xargs)

if [ "$INDEX_COUNT" -eq 6 ]; then
    echo "✓ All 6 new indexes created successfully"
else
    echo "⚠️  WARNING: Expected 6 indexes, found $INDEX_COUNT"
fi
echo ""

# Show index details
echo "→ Index details:"
psql "$DATABASE_URL" -c "
    SELECT 
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    AND indexname IN (
        'Message_embedding_idx',
        'AISummary_expiresAt_idx',
        'InviteLink_expiresAt_idx',
        'InviteLink_isActive_idx',
        'CallSession_status_idx',
        'CallSession_createdAt_idx'
    )
    ORDER BY tablename, indexname;
"
echo ""

# Test a sample query with EXPLAIN ANALYZE
echo "→ Testing message history query performance..."
psql "$DATABASE_URL" -c "
    EXPLAIN ANALYZE
    SELECT id, content, \"createdAt\"
    FROM \"Message\"
    WHERE \"channelId\" = (SELECT \"channelId\" FROM \"Message\" LIMIT 1)
    ORDER BY \"createdAt\" DESC
    LIMIT 50;
" | grep -E "(Planning Time|Execution Time|Index Scan)"
echo ""

echo "=========================================="
echo "✓ Migration Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Run query profiling: npm run db:profile"
echo "2. Document results in benchmarks/database.md"
echo "3. Compare with baseline metrics from Task 4"
echo ""

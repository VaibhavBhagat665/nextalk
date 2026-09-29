# Script to apply migration and measure impact
# Usage: .\apply-and-measure.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Database Index Optimization Migration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable not set" -ForegroundColor Red
    Write-Host "Please set DATABASE_URL before running this script"
    exit 1
}

Write-Host "✓ DATABASE_URL is set" -ForegroundColor Green
Write-Host ""

# Check if psql is available (optional, for direct SQL execution)
$psqlAvailable = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlAvailable) {
    Write-Host "⚠️  WARNING: psql not found in PATH" -ForegroundColor Yellow
    Write-Host "   Install PostgreSQL client for advanced validation"
    Write-Host "   Continuing with Prisma migration only..."
    Write-Host ""
}

# Record start time
$startTime = Get-Date

Write-Host "→ Applying migration..." -ForegroundColor Yellow
Write-Host "   This may take 5-10 minutes for large tables..."

# Apply migration
npx prisma migrate deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration failed" -ForegroundColor Red
    exit 1
}

# Record end time
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

Write-Host "✓ Migration applied successfully" -ForegroundColor Green
Write-Host "  Duration: $([math]::Round($duration, 2)) seconds"
Write-Host ""

# If psql is available, run verification
if ($psqlAvailable) {
    Write-Host "→ Verifying indexes..." -ForegroundColor Yellow
    
    # Count new indexes
    $indexQuery = @"
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
"@
    
    try {
        $indexCount = (psql $env:DATABASE_URL -t -c $indexQuery).Trim()
        
        if ($indexCount -eq "6") {
            Write-Host "✓ All 6 new indexes created successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠️  WARNING: Expected 6 indexes, found $indexCount" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  Could not verify indexes: $_" -ForegroundColor Yellow
    }
    
    Write-Host ""
    
    # Show index details
    Write-Host "→ Index details:" -ForegroundColor Yellow
    $detailQuery = @"
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
"@
    
    try {
        psql $env:DATABASE_URL -c $detailQuery
    } catch {
        Write-Host "⚠️  Could not retrieve index details: $_" -ForegroundColor Yellow
    }
    
    Write-Host ""
    
    # Test sample query
    Write-Host "→ Testing message history query performance..." -ForegroundColor Yellow
    $testQuery = @"
EXPLAIN ANALYZE
SELECT id, content, \"createdAt\"
FROM \"Message\"
WHERE \"channelId\" = (SELECT \"channelId\" FROM \"Message\" LIMIT 1)
ORDER BY \"createdAt\" DESC
LIMIT 50;
"@
    
    try {
        psql $env:DATABASE_URL -c $testQuery | Select-String -Pattern "(Planning Time|Execution Time|Index Scan)"
    } catch {
        Write-Host "⚠️  Could not run test query: $_" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✓ Migration Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:"
Write-Host "1. Run query profiling script (if available)"
Write-Host "2. Document results in benchmarks/database.md"
Write-Host "3. Compare with baseline metrics from Task 4"
Write-Host ""

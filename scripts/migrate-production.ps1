# Migration script for production database (PowerShell)
# Run this after deploying to Vercel

Write-Host "🔄 Pushing Prisma schema to production database..." -ForegroundColor Cyan
Write-Host "⚠️  Make sure DATABASE_URL is set to your production database" -ForegroundColor Yellow
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host "Please set it to your production database URL" -ForegroundColor Red
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Gray
    Write-Host '  $env:DATABASE_URL = "postgresql://user:pass@host/db"' -ForegroundColor Gray
    exit 1
}

# Show database URL (masked)
$maskedUrl = $env:DATABASE_URL -replace ':[^:@]*@', ':***@'
Write-Host "📍 Target database: $maskedUrl" -ForegroundColor Gray
Write-Host ""

# Confirm before proceeding
$confirmation = Read-Host "Continue with migration? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "❌ Migration cancelled" -ForegroundColor Red
    exit 1
}

# Run Prisma db push
Write-Host "🚀 Running prisma db push..." -ForegroundColor Cyan
npx prisma db push --skip-generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database schema pushed successfully!" -ForegroundColor Green
    Write-Host "🎉 All tables created/updated" -ForegroundColor Green
} else {
    Write-Host "❌ Migration failed" -ForegroundColor Red
    exit 1
}

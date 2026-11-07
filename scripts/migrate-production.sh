#!/bin/bash
# Migration script for production database
# Run this after deploying to Vercel

echo "🔄 Pushing Prisma schema to production database..."
echo "⚠️  Make sure DATABASE_URL is set to your production database"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set it to your production database URL"
    exit 1
fi

# Show database URL (masked)
MASKED_URL=$(echo $DATABASE_URL | sed 's/:[^:@]*@/:***@/')
echo "📍 Target database: $MASKED_URL"
echo ""

# Confirm before proceeding
read -p "Continue with migration? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

# Run Prisma db push
echo "🚀 Running prisma db push..."
npx prisma db push --skip-generate

if [ $? -eq 0 ]; then
    echo "✅ Database schema pushed successfully!"
    echo "🎉 All tables created/updated"
else
    echo "❌ Migration failed"
    exit 1
fi

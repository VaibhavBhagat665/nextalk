#!/usr/bin/env bash
# Render build script for Socket.io server
# Optimized for memory constraints

set -e  # Exit on error

echo "📦 Installing production dependencies only..."

# Set Node memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Install only production dependencies (skip devDependencies like canvas)
npm ci --omit=dev --prefer-offline --no-audit --no-fund

echo "🔄 Installing Prisma CLI..."
npm install --no-save prisma

echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "✅ Build complete!"

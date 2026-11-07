#!/usr/bin/env bash
# Render build script for Socket.io server

set -e  # Exit on error

echo "📦 Installing dependencies..."
npm ci --production=false

echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "✅ Build complete!"

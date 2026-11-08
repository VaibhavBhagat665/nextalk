#!/usr/bin/env bash
# Ultra-minimal build for memory-constrained environments
# Last resort for OOM issues

set -e

echo "🔥 ULTRA-MINIMAL BUILD MODE"
echo "⚠️  This will install ONLY what's absolutely necessary"

# Strict memory limit
export NODE_OPTIONS="--max-old-space-size=3072"

# Clear any existing node_modules to start fresh
echo "🧹 Clearing old modules..."
rm -rf node_modules

# Install ONLY production dependencies, no scripts
echo "📦 Installing minimal dependencies..."
npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --prefer-offline

# Manually rebuild only critical native modules
echo "🔨 Building mediasoup (required for voice)..."
cd node_modules/mediasoup
npm run postinstall || echo "⚠️  Mediasoup build skipped"
cd ../..

# Install Prisma separately
echo "📦 Installing Prisma CLI..."
npm install --no-save prisma@6.19.3

# Generate Prisma Client
echo "🔄 Generating Prisma Client..."
npx prisma generate

echo "✅ Minimal build complete!"
echo "📊 Final size:"
du -sh node_modules 2>/dev/null || echo "Size check unavailable"

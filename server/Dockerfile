# Multi-stage build for optimized Socket.io server image
# Requirements: 1.8

# ============================================================
# Stage 1: Build dependencies
# ============================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# ============================================================
# Stage 2: Build application
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy source code
COPY server ./server
COPY lib ./lib
COPY package*.json ./
COPY tsconfig.json ./

# Build TypeScript (if needed)
# RUN npm run build

# ============================================================
# Stage 3: Production runtime
# ============================================================
FROM node:20-alpine AS runner

# Set to production
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 socketio

WORKDIR /app

# Copy only necessary files from builder
COPY --from=deps --chown=socketio:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=socketio:nodejs /app/prisma ./prisma
COPY --from=builder --chown=socketio:nodejs /app/server ./server
COPY --from=builder --chown=socketio:nodejs /app/lib ./lib
COPY --from=builder --chown=socketio:nodejs /app/package*.json ./

# Switch to non-root user
USER socketio

# Expose Socket.io port
EXPOSE 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start Socket.io server
CMD ["node", "server/socket-server.ts"]

# ============================================================
# Build Instructions
# ============================================================
# Build image:
#   docker build -f server/Dockerfile -t nextalk-socket-server:latest .
#
# Run single instance:
#   docker run -p 3001:3001 \
#     -e DATABASE_URL="postgresql://..." \
#     -e UPSTASH_REDIS_URL="rediss://..." \
#     nextalk-socket-server:latest
#
# View logs:
#   docker logs -f <container-id>
# ============================================================

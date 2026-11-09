# Multi-stage build for Socket.io server
# Optimized for memory efficiency

# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (required for mediasoup)
RUN apk add --no-cache python3 make g++ libc6-compat py3-pip

# Copy root package files and workspace package
COPY package*.json ./
COPY packages ./packages
COPY prisma ./prisma/

# Install PRODUCTION dependencies only (skips canvas in devDependencies)
# Also install prisma and tsx needed for build
RUN npm install --production --prefer-offline && \
    npm install --no-save prisma tsx

# Generate Prisma Client
RUN npx prisma generate

# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache libc6-compat

# Copy node_modules from builder (NO canvas!)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/prisma ./prisma

# Copy application files
COPY server ./server
COPY lib ./lib
COPY package*.json ./

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Start server
CMD ["npm", "run", "start:socket"]

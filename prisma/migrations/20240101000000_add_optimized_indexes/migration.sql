-- AddOptimizedIndexes Migration
-- This migration adds performance-critical indexes for production readiness

-- ============================================================
-- Message Table Index Optimizations
-- ============================================================

-- Note: The following indexes already exist in schema but adding here for completeness:
-- CREATE INDEX IF NOT EXISTS "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");
-- CREATE INDEX IF NOT EXISTS "Message_channelId_id_idx" ON "Message"("channelId", "id");

-- ============================================================
-- Vector Index for Semantic Search (HNSW with cosine distance)
-- ============================================================
-- This creates an HNSW index optimized for cosine similarity search
-- Parameters: m=16 (connections per layer), ef_construction=64 (build quality)
CREATE INDEX IF NOT EXISTS "Message_embedding_idx" 
ON "Message" 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================
-- AISummary Table Index Optimizations
-- ============================================================

-- Index for cleanup jobs to efficiently find and remove expired summaries
CREATE INDEX IF NOT EXISTS "AISummary_expiresAt_idx" ON "AISummary"("expiresAt");

-- ============================================================
-- InviteLink Table Index Optimizations
-- ============================================================

-- Index for cleanup jobs to efficiently find and remove expired invite links
CREATE INDEX IF NOT EXISTS "InviteLink_expiresAt_idx" ON "InviteLink"("expiresAt");

-- Index for efficiently filtering active invite links
CREATE INDEX IF NOT EXISTS "InviteLink_isActive_idx" ON "InviteLink"("isActive");

-- ============================================================
-- CallSession Table Index Optimizations
-- ============================================================

-- Index for filtering calls by status (e.g., finding all active or ringing calls)
CREATE INDEX IF NOT EXISTS "CallSession_status_idx" ON "CallSession"("status");

-- Index for call history queries sorted by creation time
CREATE INDEX IF NOT EXISTS "CallSession_createdAt_idx" ON "CallSession"("createdAt");

-- ============================================================
-- Index Statistics and Analysis
-- ============================================================

-- Analyze tables to update statistics for query planner
ANALYZE "Message";
ANALYZE "AISummary";
ANALYZE "InviteLink";
ANALYZE "CallSession";

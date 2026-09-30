-- Add GIN index for full-text search on Message content
-- This enables fast keyword search to complement semantic vector search
-- Part of Task 28.1: Hybrid Retrieval System

-- Create GIN index for full-text search using tsvector
-- This index speeds up the @@ (text search) operator
CREATE INDEX IF NOT EXISTS "Message_content_fts_idx" ON "Message" USING GIN (to_tsvector('english', content));

-- Add comment explaining the index
COMMENT ON INDEX "Message_content_fts_idx" IS 'GIN index for full-text search on message content using PostgreSQL tsvector';
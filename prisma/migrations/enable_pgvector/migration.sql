-- Enable pgvector extension for vector similarity search
-- This extension provides vector data types and similarity search functions
-- Requirement: 4.1

-- Create the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is installed and get version
-- pgvector version should be >= 0.7.0 for HNSW index support
DO $$
DECLARE
    pgvector_version TEXT;
BEGIN
    SELECT extversion INTO pgvector_version 
    FROM pg_extension 
    WHERE extname = 'vector';
    
    IF pgvector_version IS NULL THEN
        RAISE EXCEPTION 'pgvector extension installation failed';
    END IF;
    
    RAISE NOTICE 'pgvector version: %', pgvector_version;
    
    -- Check if version is >= 0.7.0 for HNSW support
    IF pgvector_version::TEXT < '0.7.0' THEN
        RAISE WARNING 'pgvector version % detected. Version 0.7.0+ recommended for HNSW index support', pgvector_version;
    END IF;
END $$;

-- Add helpful comment
COMMENT ON EXTENSION vector IS 'Vector similarity search extension for AI/ML applications. Supports approximate nearest neighbor (ANN) search with HNSW and IVFFlat indexes.';

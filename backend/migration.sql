-- BATCH 2: Embedding Dimension Migration (1024)
-- This migration updates the pgvector embedding column from 384d to 1024d.
-- It also recreates the HNSW index and clears old chunks.

-- 1. Drop the old index
DROP INDEX IF EXISTS ix_document_chunks_embedding_hnsw;

-- 2. Delete existing orphaned chunks (or all chunks to be safe since dimensions are changing)
DELETE FROM document_chunks;

-- 3. Mark all COMPLETE documents as QUEUED so they get reingested with 1024d
UPDATE documents SET status = 'QUEUED' WHERE status = 'COMPLETE';

-- 4. Alter the embedding column type to vector(1024)
ALTER TABLE document_chunks 
ALTER COLUMN embedding TYPE vector(1024);

-- 5. Re-create the HNSW index for the new dimension
CREATE INDEX ix_document_chunks_embedding_hnsw 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- BATCH 3: Hybrid Search Language Fix
-- Create a new GIN index using the 'simple' text search configuration for Arabic
CREATE INDEX ix_document_chunks_text_gin_simple
ON document_chunks USING GIN (to_tsvector('simple', chunk_text));

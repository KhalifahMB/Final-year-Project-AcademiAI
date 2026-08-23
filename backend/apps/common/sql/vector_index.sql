-- Run after embeddings exist
CREATE INDEX IF NOT EXISTS resource_chunks_embedding_hnsw
  ON resource_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Pre-installs pgvector as the bootstrap superuser.
-- The application role cannot create extensions; migrations only need
-- the type to exist (CREATE EXTENSION ... IF NOT EXISTS then no-ops).
-- Installing into template1 ensures test databases inherit it as well.
CREATE EXTENSION IF NOT EXISTS vector;
\c template1
CREATE EXTENSION IF NOT EXISTS vector;

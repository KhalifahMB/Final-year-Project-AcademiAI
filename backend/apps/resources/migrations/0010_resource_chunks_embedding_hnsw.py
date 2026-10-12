"""Add the HNSW approximate-nearest-neighbour index on resource_chunks.embedding.

Django cannot express an HNSW index through Meta.indexes, so it is created directly.
Without it the dense leg of hybrid retrieval is an exact sequential scan over every
authorised chunk: CosineDistance ordering in apps/knowledge/retrieval.py has no index
to use. This is D16.

The partial predicate mirrors the ``exclude(embedding=None)`` filter in that same
query so the planner is free to use the index.

Revision on migration 0009: that migration added the stored ts_vector column and its
GIN index, but its RunSQL section was edited in after the migration had already been
recorded as applied, so the HNSW index was never created. This migration carries it.
"""

from django.db import migrations

CREATE_HNSW = (
    "CREATE INDEX IF NOT EXISTS resource_chunks_embedding_hnsw "
    "ON resource_chunks USING hnsw (embedding vector_cosine_ops) "
    "WHERE embedding IS NOT NULL"
)

DROP_HNSW = "DROP INDEX IF EXISTS resource_chunks_embedding_hnsw"


class Migration(migrations.Migration):

    dependencies = [
        ("resources", "0009_resourcechunk_ts_vector_and_more"),
    ]

    operations = [
        migrations.RunSQL(sql=[CREATE_HNSW], reverse_sql=[DROP_HNSW]),
    ]

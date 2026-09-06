# Local Development

## Services

Recommended Docker Compose services:

- PostgreSQL with pgvector
- RabbitMQ
- Redis
- MinIO
- Django API
- Celery worker
- Celery beat if scheduled jobs are required

React/Vite may run directly on the developer machine.

## RabbitMQ

RabbitMQ is the local Celery task broker for AI generation, document ingestion, embeddings, concept extraction, and transactional email.

## Redis

Redis is used for caching and short-lived application state, not as the primary Celery broker.

## MinIO

MinIO provides S3-compatible local object storage.

Application code should use the S3 API abstraction so production can switch to AWS S3 with configuration changes rather than application rewrites.

## Development database

Use PostgreSQL + pgvector rather than SQLite because the production data model depends on PostgreSQL features including RLS, full-text search, and pgvector.

## Debug toolbar

Django Debug Toolbar is enabled only in development.

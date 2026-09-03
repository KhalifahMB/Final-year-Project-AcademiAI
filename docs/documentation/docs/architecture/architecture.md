# Architecture

## Component view

```text
React + Vite + JavaScript
        |
        | HTTPS / REST
        v
Django REST Framework
        |
  +-----+------------------------------+
  |     |          |          |        |
Auth  Academic   Resource    RAG     Admin
      Domain     Pipeline    Service
        |           |          |
        +-----------+----------+
                    |
             PostgreSQL + pgvector
                    |
          +---------+---------+
          |                   |
        Redis              Object Storage
                             |
                     MinIO / AWS S3
                    |
             Celery Workers
                    |
                 Gemini API
```

## Deployment modes

### Local
- Django
- PostgreSQL + pgvector
- Redis (cache)
- RabbitMQ (Celery task broker)
- Celery worker
- MinIO
- React/Vite

### Production
- Django application deployment
- managed PostgreSQL with pgvector support or appropriately operated PostgreSQL
- Redis service
- AWS S3
- production email service
- Gemini API
- HTTPS and managed secrets

Production cloud provisioning is intentionally outside this documentation-only package.

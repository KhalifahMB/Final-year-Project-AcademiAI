# AcademiAI v2 Documentation Index

This package contains documentation/design only. It does not contain backend or frontend source code.

## Key decisions

- PostgreSQL + pgvector
- MinIO locally; AWS S3 in production
- Django + DRF
- Celery + RabbitMQ (broker) + Redis (cache)
- React + Vite + JavaScript
- Tailwind CSS + shadcn/ui
- JWT
- OpenAPI 3 with drf-spectacular and Swagger UI
- Django Debug Toolbar for development
- structured Python logging
- shared-schema multi-tenancy with PostgreSQL RLS
- transactional email service abstraction

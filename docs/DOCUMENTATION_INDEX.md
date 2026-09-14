# AcademiAI v2 Documentation Index

This package contains documentation/design only. It does not contain backend or frontend source code.

## Repo-root living docs

- [`README.md`](../README.md) — authoritative overview, stack, setup, testing.
- [`SETUP.md`](../SETUP.md) — single-file local quick-start.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — contribution workflow and conventions.
- [`DESIGN.md`](../DESIGN.md) — visual/brand contract.
- [`PRODUCT.md`](../PRODUCT.md) — product positioning and voice.
- [`FRONTEND_STACK.md`](FRONTEND_STACK.md) — frontend screen + shared-component inventory.
- [`DEV.md`](DEV.md) — current development status + command cheatsheet.
- [`DECISIONS.md`](DECISIONS.md) — recorded specification and implementation decisions.
- [`FUTURE_IMPLEMENTATIONS.md`](FUTURE_IMPLEMENTATIONS.md) — scaffolded-but-incomplete features and roadmap.

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

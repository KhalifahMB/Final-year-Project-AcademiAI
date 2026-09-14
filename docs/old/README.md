# AcademiAI v2 — Project Documentation

AcademiAI is a proposed multi-tenant AI-powered academic assistant and intelligent resource hub. This documentation package defines the product, architecture, database, backend, frontend, security, infrastructure, email services, testing, and development standards.

## Authoritative technology decisions

- Backend: Python, Django, Django REST Framework
- Database: PostgreSQL with pgvector
- Task broker: RabbitMQ
- Cache: Redis
- Background processing: Celery
- Object storage: MinIO for local development; AWS S3 for production
- AI provider: Google Gemini API
- API documentation: drf-spectacular / OpenAPI 3
- Development diagnostics: Django Debug Toolbar
- Backend logging: Python logging with structured application conventions
- Frontend: React + Vite + JavaScript
- Styling: Tailwind CSS + shadcn/ui
- Authentication: JWT
- API style: REST
- Multi-tenancy: shared database/schema with tenant_id and PostgreSQL Row-Level Security
- Documentation: Markdown + OpenAPI

## Documentation map

- `product/PRD.md` — product requirements
- `architecture/design.md` — system design
- `architecture/architecture.md` — component and deployment architecture
- `database/schema.md` — authoritative relational schema
- `backend/backend.md` — backend architecture
- `backend/api.md` — complete CRUD/API contract
- `backend/swagger-openapi.md` — Swagger/OpenAPI implementation
- `frontend/frontend.md` — frontend architecture
- `security/security.md` — security model
- `security/tenant-isolation.md` — multi-tenancy and RLS
- `email/email-services.md` — verification, welcome, reset, and password-change email flows
- `infrastructure/local-development.md` — local environment
- `infrastructure/aws-s3.md` — production S3
- `testing/testing.md` — test strategy
- `libraries.md` — dependency inventory

## Scope

This package is documentation/design only. No application source code is included.

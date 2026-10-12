# Swagger / OpenAPI Documentation

## Standard

Use OpenAPI 3 as the API contract.

For Django REST Framework, use **drf-spectacular** to generate the OpenAPI schema and Swagger UI/ReDoc documentation.

The generated documentation is mounted at these routes
(`backend/config/urls.py:34-44`):

- `/api/schema/` — the raw OpenAPI 3 document
- `/api/schema/swagger-ui/` — Swagger UI
- `/api/schema/redoc/` — ReDoc

> **Status: currently broken.** `GET /api/schema/` returns HTTP 500 —
> `TypeError: 'Meta.fields' must not contain non-model field names: session`, raised from
> `backend/apps/chat/views.py:112-113`, where `ChatSessionViewSet` declares
> `filterset_fields` naming a non-model field. The endpoint is not covered by any test, so
> CI does not catch it. Recorded as **D2** in
> [`docs/report/DEFECTS.md`](../report/DEFECTS.md#d2--the-openapi-schema-endpoint-returns-http-500-high).
> Until it is fixed, the checked-in `backend/AcademiAI API.yaml` is stale and should not be
> treated as the contract.

## Documentation requirements

Every endpoint must document:
- summary
- description
- operation ID
- tags
- authentication requirements
- request body
- response schemas
- status codes
- path/query parameters
- pagination
- validation errors
- authorization constraints

## Schema conventions

Use reusable OpenAPI component schemas for:
- User
- Tenant
- Faculty
- Department
- Programme
- Course
- CourseOffering
- Resource
- ResourceChunk
- Concept
- ChatSession
- ChatMessage
- Quiz
- Question
- Error

## Security scheme

Document JWT bearer authentication:

`Authorization: Bearer <access_token>`

The generated OpenAPI specification must be the source of truth for API consumers.

## API documentation quality

Do not rely only on automatically inferred serializer fields. Explicitly annotate ambiguous endpoints and custom actions.

All CRUD endpoints must appear in the generated schema.

# Swagger / OpenAPI Documentation

## Standard

Use OpenAPI 3 as the API contract.

For Django REST Framework, use **drf-spectacular** to generate the OpenAPI schema and Swagger UI/ReDoc documentation.

The generated documentation should be available in development at routes such as:

- `/api/schema/`
- `/api/docs/`
- `/api/redoc/`

Exact route names can be changed in the implementation, but the contract must remain OpenAPI 3.

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

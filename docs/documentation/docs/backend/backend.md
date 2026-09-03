# Backend Documentation

## Stack

- Python
- Django
- Django REST Framework
- PostgreSQL + pgvector
- RabbitMQ (Celery task broker)
- Redis (cache)
- Celery
- JWT
- boto3 / S3-compatible storage
- Gemini API
- OpenAPI/Swagger
- Django Debug Toolbar in development
- Python logging

## Django app boundaries

Recommended apps/modules:
- accounts
- tenants
- academics
- resources
- knowledge
- chat
- assessments
- learning
- audit
- common

Keep domain logic out of oversized views. Use serializers for validation, service functions/classes for workflows, and model constraints for invariant data integrity.

## Authentication

JWT access/refresh tokens are used for API authentication. Email verification is required before normal account use according to product policy.

## Authorization

Authorization is layered:
1. authentication
2. tenant membership
3. role permissions
4. object/resource authorization
5. academic relationship checks
6. PostgreSQL RLS

## Transactions

Use database transactions for:
- enrollment
- lecturer assignment
- tenant/institution structure changes where multiple records must remain consistent
- quiz attempt submission
- resource metadata/version writes

## Background tasks

Celery uses RabbitMQ as the task broker. Redis is reserved for caching and short-lived application state.

Recommended queues: `ai`, `ingestion`, `email`.

Celery tasks:
- process uploaded resources
- extract text
- create chunks
- generate embeddings
- extract concepts
- send email
- cleanup expired verification/reset tokens

Tasks should be retryable and idempotent where possible.

## Logging

Use Python's logging package with environment-configurable levels.

Log:
- request correlation ID
- user/tenant context where safe
- authentication events
- authorization failures
- resource processing lifecycle
- Celery task lifecycle
- external provider failures
- unexpected exceptions

Never log:
- passwords
- JWTs
- verification codes
- password-reset tokens
- full private document contents
- sensitive email content

Use JSON-like structured fields in production if the deployment environment supports structured logs.

## Django Debug Toolbar

Django Debug Toolbar is development-only.

Enable it only under a development configuration and restrict it to approved development hosts/IPs. Never expose the toolbar in production.

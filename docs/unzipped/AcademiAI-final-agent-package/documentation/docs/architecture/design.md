# System Design

## 1. Architectural style

AcademiAI is designed as a modular monolith with asynchronous workers. This keeps deployment and development manageable while allowing clear separation of domain modules.

## 2. Logical layers

1. Presentation layer — React/shadcn/ui frontend.
2. API layer — Django REST Framework.
3. Application/service layer — business workflows and authorization decisions.
4. Domain/data layer — Django models and PostgreSQL.
5. Retrieval layer — PostgreSQL full-text search + pgvector + concept graph.
6. Asynchronous layer — Celery + Redis.
7. Storage layer — MinIO locally, AWS S3 in production.
8. External services — Gemini and transactional email provider.

## 3. Academic domain

Tenant
→ Faculty
→ Department
→ Programme
→ Course
→ Course Offering

Course Offering
→ Academic Session
→ Semester
→ Lecturer Assignment
→ Student Enrollment

## 4. RAG pipeline

1. Authenticate user.
2. Resolve tenant context.
3. Authorize the requested academic scope.
4. Normalize/query-understand the question.
5. Run dense vector retrieval through pgvector.
6. Run PostgreSQL lexical/full-text retrieval.
7. Fuse candidate rankings using Reciprocal Rank Fusion.
8. Use concept relationships for expansion/reranking.
9. Re-check resource authorization.
10. Assemble grounded context.
11. Generate response with Gemini.
12. Persist source references for the answer.
13. Return answer with citations.

## 5. Document ingestion

Upload → validation/quarantine → malware scan → object storage → text extraction → chunking → embedding → concept extraction → indexing → ready.

Failed jobs must retain a failure state and safe diagnostic information.

## 6. Asynchronous processing

Celery handles:
- AI quiz generation
- AI summaries
- document processing
- embedding generation
- concept extraction
- email delivery
- cleanup jobs
- other tasks that do not need to block an HTTP request

RabbitMQ is the official Celery task broker. Redis is used separately for caching and other short-lived application state.

Recommended task queues:
- `ai` — quiz generation, summarization, RAG evaluation
- `ingestion` — text extraction, chunking, embeddings, concept extraction
- `email` — verification, welcome, password reset, security notifications.

## 7. Caching

Cache keys must include tenant and relevant authorization scope. Never cache a resource response under a global key if the response can differ by tenant/user.

## 8. Design principle

Authorization is performed before retrieval and is not treated as an afterthought. Retrieval candidates are tenant-scoped, and final source selection is authorized again before context assembly.

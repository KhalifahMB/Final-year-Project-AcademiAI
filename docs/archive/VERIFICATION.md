# AcademiAI — PRD / documentation verification

Reviewed against:

- `documentation/docs/product/PRD.md`
- `documentation/docs/architecture/architecture.md`
- `documentation/docs/database/schema.md`
- `documentation/docs/backend/api.md`

Generated: local agent review (no live Postgres in sandbox).

## Product goals (PRD §3)

| Goal | Status | Evidence |
|------|--------|----------|
| Institution-scoped resource management | **Met** | TenantScoped models, Resource CRUD, visibility scopes |
| Grounded AI Q&A | **Met** | Chat send → hybrid_retrieve → Gemini + citations |
| Faculty→…→Course hierarchy | **Met** | academics models + ViewSets + migrations |
| Concept-aware retrieval | **Partial → improved** | Concept/Edge models + RRF concept signal (name match → resource_concepts) |
| Quizzes, notes, bookmarks, progress | **Met** | assessments + learning APIs + UI pages |
| Multi-tenancy + RLS | **Met (code)** | Middleware GUC + `apply_rls` SQL; **apply requires live DB** |
| Auditable APIs + async processing | **Met** | AuditLog, Celery queues ai/ingestion/email |

## Roles (PRD §5)

| Role | Status |
|------|--------|
| Student | Resources/chat/quizzes/notes (scoped); attempt quizzes |
| Lecturer | Generate quiz, manage resources (permission classes) |
| Admin | Audit logs, full CRUD, seed_demo admin |

## Functional requirements vs API

| Area | PRD | Implementation |
|------|-----|----------------|
| Auth (signup→change password) | Required | All listed routes present under `/api/v1/auth/` |
| PATCH `/auth/me/` | Required | `MeView` = `RetrieveUpdateAPIView` → GET+PATCH |
| Tenant + hierarchy CRUD | Required | tenants, faculties, departments, programmes, sessions, semesters |
| Courses / offerings / enroll / assign | Required | ViewSets registered |
| Resources upload/version/status | Required | presign, complete_upload, processing_status, chunks |
| Chat + hybrid retrieval + citations | Required | sessions, messages, ChatMessageSource |
| Quizzes + attempts | Required | generate async, submit scoring |
| Notes / bookmarks / progress | Required | learning app |
| Audit logs | Required | admin-only list |

## Non-functional (PRD §9)

| NFR | Status | Notes |
|-----|--------|-------|
| JWT + password hashing | Met | SimpleJWT + Django hashers |
| PostgreSQL RLS | Code ready | Not applied until `migrate` + `apply_rls` |
| Rate limiting | Configured | DRF DEFAULT_THROTTLE_RATES in settings |
| Async processing | Met | Celery + RabbitMQ routes |
| pgvector embeddings | Met | VectorField + embedding task |
| Full-text search | Met | SearchVector/SearchRank in retrieval |
| Malware scan | **Gap** | Hook placeholder only |
| PDF/OCR extraction | **Gap** | Text decode only in ingestion |
| HNSW index | **Doc/SQL commented** | Enable after data load |
| HTTPS / prod secrets | Out of scope | Per PRD non-goals |

## Architecture alignment

| Component | Spec | Code |
|-----------|------|------|
| Django modular monolith | Yes | apps by domain |
| Postgres + pgvector | Yes | settings + VectorField |
| RabbitMQ broker / Redis cache | Yes | CELERY_BROKER_URL vs RESULT_BACKEND/cache |
| MinIO/S3 via boto3 | Yes | common.storage |
| Gemini abstraction | Yes | common.ai.gemini (+ stubs without key) |
| React+Vite+JS (no TS) | Yes | frontend/ |

## Acceptance principles (PRD §10) residual gaps

1. Live `migrate` + `apply_rls` + E2E on real stack — **operator step**
2. Malware scanning + PDF/OCR — **future hardening**
3. Broader automated API tests — **stubs exist; expand with DB**
4. Full GitHub tree push — **credentials required**

## Offline verification run

```
python manage.py smoke_check
→ OK imports, OK routes (299 patterns), OK settings
```

## Remaining work for defense demo

1. On a machine with Docker: compose up → migrate → apply_rls → seed_demo → runserver + celery  
2. `./scripts/e2e_smoke.sh`  
3. Manual: upload text resource → chat grounded answer → generate quiz  

**Verdict:** Core PRD scope is implemented in code. Remaining blockers are **runtime infrastructure** and **hardening gaps** (scan/OCR), not missing primary modules.

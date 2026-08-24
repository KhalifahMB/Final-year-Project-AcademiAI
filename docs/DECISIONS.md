# AcademiAI — Implementation Decisions Record

Traceability for specification gaps identified in Phase 0 and decisions taken
during implementation. Each entry states the gap, the decision, and its impact.
Where a decision deviates from or extends the supplied documentation, that is
stated explicitly.

## D1 — Email provider abstraction

**Gap:** The documentation requires an email-service abstraction but does not
name a concrete provider.

**Decision:** Django's SMTP backend (`django.core.mail.backends.smtp.EmailBackend`)
is the production path; `console` backend is used in local development and
`locmem` in tests. All flows go through Celery tasks on the `email` queue, so
switching to SES/SendGrid/Postmark later means changing only settings/transport,
never business logic.

## D2 — JWT logout / token invalidation strategy

**Gap:** `api.md` lists `POST /auth/logout/` without specifying the mechanism.

**Decision:** Refresh-token rotation with SimpleJWT's token blacklist
(`BLACKLIST_AFTER_ROTATION = True`). `POST /auth/logout/` blacklists the
supplied refresh token. The blacklist lives in the database
(`token_blacklist` app); Redis remains cache-only per the architecture rules.

## D3 — RLS database role model

**Gap:** The spec mandates RLS and forbids `BYPASSRLS` but does not define how
migrations run versus the runtime role.

**Decision:** Two-role model implemented via
`infrastructure/postgres/init/01-app-role.sql`:

- `academiai` — Docker bootstrap superuser; owns nothing at runtime.
- `academiai_app` — LOGIN, `NOSUPERUSER`, **NOBYPASSRLS**, `CREATEDB`
  (needed by pytest-django; revoke in production). Used by Django for
  migrations, runtime traffic, and tests.

All tenant-scoped tables use `ENABLE ROW LEVEL SECURITY` +
`FORCE ROW LEVEL SECURITY` + a policy keyed on
`current_setting('app.current_tenant_id', true)`. Because the runtime role is
the table owner, FORCE is required and applied. Database-level tests
(`apps/common/tests/test_rls.py`) prove cross-tenant read/insert/update denial.

## D4 — Tenant GUC lifecycle (implementation-critical)

**Problem:** A transaction-local tenant setting (`set_config(..., true)`) set
outside a transaction evaporates immediately under autocommit, silently
disabling RLS for every subsequent query.

**Decision:** `TenantContextMiddleware` wraps the entire authenticated request
in one transaction and sets the GUC inside it
(`apps/common/middleware.py`). Background tasks use the equivalent
`apps.common.db.tenant_scope(tenant_id)` context manager. Tasks receive
`tenant_id` as an explicit argument because reading any tenant row before the
GUC is set would return nothing once RLS is active.

## D5 — Gemini models and embedding dimension

**Decision:** Generation defaults to `gemini-1.5-flash`, embeddings to
`text-embedding-004`, dimension 768. All configurable via env
(`GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`).
The AI module (`apps/common/ai/gemini.py`) degrades to deterministic stubs
when no API key is configured so local pipelines remain testable.

## D6 — Document extraction stack

**Decision:** `pypdf` for PDFs, `python-docx` for DOCX (paragraphs + tables),
`python-pptx` for PPTX (text frames + tables), UTF-8 text otherwise.
Covered by unit tests (`apps/resources/tests/test_extraction.py`). Binary
formats without extractable text are rejected with "No extractable text"
rather than mis-processed.

## D7 — Malware scanning hook

**Decision:** Strict MIME allow-list + size cap + magic-byte/EICAR-signature
check in `apps/common/security/file_validation.py`, with an optional ClamAV
hook activated when `clamd` is installed. No AV daemon ships in compose by
default.

## D8 — `curriculum_courses` API surface

**Decision:** Model exists per the authoritative schema (composite PK
programme/course). No dedicated CRUD endpoint yet; curriculum data is managed
through programmes/courses. Read endpoints can be added without migration.

## D9 — Resource permission semantics

**Decision:** `resource_permissions` rows are disjunctive (any matching row
grants). Retrieval authorization combines: tenant membership, visibility scope
(private→uploader only; course→enrolled/assigned; institution→all members),
plus explicit permission rows.

## D10 — Concept relation vocabulary

**Decision:** `relation_type` is stored as a free string (per schema.md);
documented vocabulary: `prerequisite_of`, `related_to`, `part_of`,
`example_of`, `contrasts_with`. Enforcing a DB CHECK constraint can be added
without model changes.

## D11 — Frontend design tokens

**Decision:** Tailwind CSS v4 + shadcn/ui with the neutral palette and the
project's academic/professional typography direction. No brand brief was
supplied; tokens live in `frontend/src/index.css`.

## D12 — `users.tenant_id` nullability

**Decision:** Treated as non-null in practice (signup requires an active
tenant slug; superuser bootstrap excepted). The column stays nullable per
schema.md to allow future platform-level identities.

## D13 — `users` table exclusion from RLS policies (documented deviation)

**Conflict:** Spec says every tenant-scoped table must have RLS, but login
must look users up by email *before* authentication establishes a tenant
context. With RLS on `users` and no GUC set, authentication would be
impossible without a BYPASSRLS role (forbidden).

**Decision:** `users` (plus `email_verification_codes` / `password_reset_tokens`,
which have no `tenant_id` column) are excluded from RLS policies. Compensating
controls:

- `users.email` is globally unique;
- every user-facing queryset filters by the server-derived tenant;
- role changes and sensitive admin actions are audited;
- all other 26 tenant-scoped tables are RLS-enforced and tested.

## D14 — Job status surface

**Gap:** The schema has no dedicated `jobs` table.

**Decision:** Uniform status surface via Celery result backend:
`GET /api/v1/jobs/{job_id}/` returns `{job_id, status, ready, successful,
result?, error?}`. Resources additionally carry `processing_status`/
`processing_error`; quizzes carry `generation_job_id`.

## D15 — Quiz attempt submission endpoint (documented extension)

**Decision:** Added `POST /quiz-attempts/{id}/submit/` beyond `api.md`, per the
doc's own note that submission should be an explicit operation. Scoring is
server-side; resubmission returns 409.

## D16 — Email verification gate at login

**Decision:** Login returns 403 "Email not verified." until verification
completes (PRD: verification required before normal account use).

## D17 — Academic structure write permissions

**Decision:** Reads on faculties/departments/programmes/sessions/semesters/
courses/offerings/assignments/enrollments are open to authenticated tenant
members; create/update/delete require the Admin role
(`AdminWriteViewSet`). Tenant CRUD likewise admin-write.

## D18 — Redis vs RabbitMQ conflict note

`documentation/libraries.md` once described Redis as "Cache/broker";
`architecture.md` and the build prompt mandate RabbitMQ as broker. Resolution:
RabbitMQ is the sole Celery broker (`config/celery.py`); Redis is cache
(Django cache backend) and Celery result transport only. Implementation matches
the authoritative documents; libraries.md wording superseded.

## Known limitations

0. **Windows dev workers use the solo pool.** billiard's prefork pool crashes
   on win32 (shared-semaphore `Access is denied` / invalid-handle errors).
   `config/celery.py` auto-selects `worker_pool = "solo"` on Windows, so local
   tasks execute sequentially; Docker/Linux deployments keep the default pool.
   Override with `CELERY_FORCE_PREFORK=1` if required.
1. RAG evaluation: the harness exists (`manage.py evaluate_rag` — compares
   dense / hybrid / concept modes with Precision@K, Recall@K, MRR) but no
   labelled ground-truth dataset has been curated yet, so **no benchmark
   numbers exist**. Numbers must come from human-labelled queries against a
   real corpus; none are claimed.
2. Chat send executes retrieval + generation synchronously in-request
   (bounded); long-running summarization/quiz generation are already async
   with job polling.
3. Presigned multipart uploads deferred; single PUT presign used.
4. Frontend tests cover routing/access control and login validation
   (Vitest + Testing Library, `npm test`); full end-to-end browser tests are
   not part of this phase.

## Test inventory (as of last run)

Backend (`pytest`, 29 passing):
- auth flow: signup → verify (single-use) → login gate → me → password change
- password reset: generic responses, token single-use
- cross-tenant API isolation/IDOR: read/update/delete denied, tenant spoofing
  on create ignored, student write denial, notes privacy
- database RLS: cross-tenant read/update denial, insert without context denied
- retrieval authorization units, RRF fusion, RAG metrics
- file validation, text extraction (PDF path via pypdf import guard, DOCX,
  PPTX, plain text, chunk overlap)

Frontend (`npm test`, 6 passing):
- unauthenticated redirect to login; authenticated dashboard render
- role gate: student denied admin page; admin allowed
- login form: invalid email blocked client-side; API error surfaced

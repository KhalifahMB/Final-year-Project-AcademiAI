# Documentation Index

Every document in this repository, what it is authoritative for, and whether it is
currently accurate. **Read the status column.** Several documents here are specifications
rather than descriptions, and a few had drifted from the code; the drift is recorded rather
than quietly fixed, because a stale document that reads as current is worse than no
document.

Last audited: alongside the final-year project report under [`report/`](report/).

---

## Where to start

| If you want to… | Read |
|---|---|
| Get the project running | [`../README.md`](../README.md) → [`../SETUP.md`](../SETUP.md) |
| Understand the code layout | [`../AGENTS.md`](../AGENTS.md), [`DEV.md`](DEV.md) |
| Know *why* something is the way it is | [`DECISIONS.md`](DECISIONS.md) |
| Read the academic write-up | [`report/README.md`](report/README.md) |
| Change something safely | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |

---

## Repo-root documents

| Document | Authoritative for | Status |
|---|---|---|
| [`../README.md`](../README.md) | Stack, full local setup, testing commands | Current |
| [`../SETUP.md`](../SETUP.md) | Single-file local quick-start | Current |
| [`../AGENTS.md`](../AGENTS.md) | Agent working rules — commands, RLS invariants, structure rules | Current |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Contribution workflow, per-area conventions | Current |
| [`../DESIGN.md`](../DESIGN.md) | Visual and brand contract | Current |
| [`PRODUCT.md`](PRODUCT.md) | Product positioning and voice | Current |
| [`PRODUCT_ROADMAP.md`](PRODUCT_ROADMAP.md) | Planned work, sequenced | Forward-looking by nature |
| [`FUTURE_IMPLEMENTATIONS.md`](FUTURE_IMPLEMENTATIONS.md) | Scaffolded-but-incomplete features | Forward-looking; verify against code before relying on it |
| [`DEV.md`](DEV.md) | Current dev status + command cheatsheet | Current |
| [`DECISIONS.md`](DECISIONS.md) | Recorded specification and implementation decisions | Current — the canonical "why" document |

---

## Final-year project report

Under [`report/`](report/). Source-grounded: every figure is measured and reproducible, and
no questionnaire results are claimed because no study was conducted.

| Document | Contents | Status |
|---|---|---|
| [`report/README.md`](report/README.md) | How to read the report, reproduction instructions | Current |
| [`report/EVIDENCE.md`](report/EVIDENCE.md) | Every measured number, the command that produced it, and the date | Current |
| [`report/DEFECTS.md`](report/DEFECTS.md) | 16 verified defects with reproductions, causes and fixes — 15 since fixed (only D11 open) | Current |
| [`report/CHAPTER_1_INTRODUCTION.md`](report/CHAPTER_1_INTRODUCTION.md) | Background, problem, aims, scope | Current |
| [`report/CHAPTER_2_LITERATURE_REVIEW.md`](report/CHAPTER_2_LITERATURE_REVIEW.md) | Literature review and the database justification | Current |
| [`report/CHAPTER_3_METHODOLOGY.md`](report/CHAPTER_3_METHODOLOGY.md) | Methodology adopted and rejected, system architecture | Current |
| [`report/CHAPTER_4_ANALYSIS_AND_DESIGN.md`](report/CHAPTER_4_ANALYSIS_AND_DESIGN.md) | Requirements, UML, ER and physical database design | Current |
| [`report/CHAPTER_5_RESULTS_AND_DISCUSSION.md`](report/CHAPTER_5_RESULTS_AND_DISCUSSION.md) | Test results and 62 screenshot discussions | Current |
| [`report/CHAPTER_6_CONCLUSION_AND_RECOMMENDATION.md`](report/CHAPTER_6_CONCLUSION_AND_RECOMMENDATION.md) | Conclusions, open issues, recommendations, future work | Current |
| [`report/APPENDIX.md`](report/APPENDIX.md) | SUS instrument, glossary, traceability matrix, reproduction steps | Current |

---

## Architecture and design

| Document | Authoritative for | Status |
|---|---|---|
| [`architecture/architecture.md`](architecture/architecture.md) | Layer and module architecture | Current |
| [`architecture/design.md`](architecture/design.md) | Component and data-flow design | Current |
| [`database/schema.md`](database/schema.md) | Database schema | Current, but see the note below |

---

## Backend

| Document | Authoritative for | Status |
|---|---|---|
| [`backend/backend.md`](backend/backend.md) | Django app layout, settings, management commands | Current |
| [`backend/api.md`](backend/api.md) | Endpoint-by-endpoint REST reference | **Partially stale — see note** |
| [`backend/swagger-openapi.md`](backend/swagger-openapi.md) | OpenAPI 3 contract requirements | Specification; the generator endpoint is fixed (**D2**) and runs in CI |

> **Note on `backend/api.md`.** It predates recent endpoints and does not cover all 36
> registered viewsets. **D2** is now fixed, so the schema *is* regenerable — that has been
> done for the checked-in `backend/AcademiAI API.yaml`. This hand-written file remains a
> prose reference; treat
> [`report/EVIDENCE.md §2`](report/EVIDENCE.md#2-backend-structural-counts) for the current
> API surface, or read the regenerated OpenAPI file.

---

## Frontend

| Document | Authoritative for | Status |
|---|---|---|
| [`frontend/frontend.md`](frontend/frontend.md) | Vite, Tailwind, routing and component organisation | Current |
| [`FRONTEND_STACK.md`](FRONTEND_STACK.md) | Screen inventory and shared-component inventory | Current — corrected: `tailwind.config.js` and `components.json` exist (the Tailwind config is inert); the duplicate `postcss.config.js` was removed (see **D9**) |

> Theming source of truth is `frontend/src/index.css`, which defines `oklch()` tokens as CSS
> custom properties. `frontend/tailwind.config.js` maps those tokens for editor and shadcn
> intellisense only — changing app colours means editing `index.css`.

---

## Infrastructure

| Document | Authoritative for | Status |
|---|---|---|
| [`infrastructure/local-development.md`](infrastructure/local-development.md) | Docker Compose services, ports, health checks | Current |
| [`infrastructure/aws-s3.md`](infrastructure/aws-s3.md) | Swapping MinIO for AWS S3 in production | Current |
| [`DEPLOYMENT_BACKEND.md`](DEPLOYMENT_BACKEND.md) | Backend deployment runbook + known backend risks | Current — its **M6** item flagged the missing GIN and vector indexes, the finding reported as **D16**; M6 is now marked resolved |
| [`DEPLOYMENT_FRONTEND.md`](DEPLOYMENT_FRONTEND.md) | Frontend build and hosting | Current |
| [`DEPLOYMENT_AI_CHAT_AGENT.md`](DEPLOYMENT_AI_CHAT_AGENT.md) | AI/chat-agent deployment and model configuration | Current |

---

## Security and data isolation

| Document | Authoritative for | Status |
|---|---|---|
| [`security/tenant-isolation.md`](security/tenant-isolation.md) | The shared-schema multi-tenancy model and RLS policies | Current — 45 tables, keyed on `app.current_tenant_id` |
| [`security/security.md`](security/security.md) | Authentication, tokens, permissions, throttling | Current |
| [`security/threat-model.md`](security/threat-model.md) | Threat categories and mitigations | Current |

---

## Product and requirements

| Document | Authoritative for | Status |
|---|---|---|
| [`product/PRD.md`](product/PRD.md) | Product requirements | Current |
| [`product/requirements.md`](product/requirements.md) | Functional and non-functional requirement identifiers | Current — the report's `FR-###` / `NFR-###` references resolve against this file |

---

## Email, testing, feature designs

| Document | Authoritative for | Status |
|---|---|---|
| [`email/email-services.md`](email/email-services.md) | Transactional email abstraction, Mailpit in development | Current |
| [`testing/testing.md`](testing/testing.md) | Test strategy and layout | Current |
| [`development/setup.md`](development/setup.md) | Development environment notes | Current |
| [`superpowers/plans/2026-09-22-chat-send-fix-and-rls-enforcement.md`](superpowers/plans/2026-09-22-chat-send-fix-and-rls-enforcement.md) | Dated implementation plan | **Historical.** Describes work as proposed at that date |
| [`superpowers/specs/2026-09-22-quiz-manager-chat-nav-design.md`](superpowers/specs/2026-09-22-quiz-manager-chat-nav-design.md) | Dated design spec | **Historical.** Same caveat |

The two `superpowers/` documents are kept deliberately: they are the only surviving record of
*why* the chat-send RLS enforcement and the quiz-manager navigation were built the way they
were. They are proposals, not descriptions — read them as history.

---

## Key technical decisions

- **Database:** PostgreSQL 16 with `pgvector`, chosen over the report template's MySQL —
  see [`report/CHAPTER_2_LITERATURE_REVIEW.md §2.5`](report/CHAPTER_2_LITERATURE_REVIEW.md#25-database-management-system)
- **Backend:** Django + Django REST Framework, modular monolith under `backend/apps/`
- **Async:** Celery + RabbitMQ (broker) + Redis (cache and result backend), 5 queues
- **Frontend:** React 19 + Vite, plain JavaScript, Tailwind v4 CSS-first tokens, shadcn/ui
- **Auth:** JWT, four roles plus a public institution-request flow
- **Storage:** MinIO locally, AWS S3 in production, both via the S3 API
- **Isolation:** shared-schema multi-tenancy with PostgreSQL row-level security, policy
  coverage derived from the model registry
- **Retrieval:** dense + lexical + concept signals fused with Reciprocal Rank Fusion
- **API documentation:** OpenAPI 3 via `drf-spectacular` — endpoint fixed (**D2**); the schema
  generates successfully and is regenerated in CI

---

## Known documentation problems

Recorded rather than hidden (current state after the hardening pass):

1. **`/api/schema/` returned HTTP 500** (**D2**) — now fixed. The viewset queryset matches
   its `filterset_fields`, `backend/AcademiAI API.yaml` has been regenerated, and schema
   generation runs in CI. The remaining item is the hand-written
   [`backend/api.md`](backend/api.md), which is prose rather than generated output.
2. **`backend/api.md` predates recent endpoints** and does not cover all 36 registered
   viewsets.
3. **Retrieval indexes were described as present when they were not** (**D16**) — now
   resolved. `resource_chunks.embedding` has a partial `hnsw` index and `ResourceChunk`
   has a stored `tsvector` column with a `GIN` index, both added by migrations `0009` and
   `0010`. `DEPLOYMENT_BACKEND.md` **M6** recorded the same gap and has been marked
   resolved; the report's Chapter 4 and Chapter 2 have been corrected too. The follow-up
   RLS-cast fix (`tenant_id = NULLIF(current_setting(...), '')::uuid`) means the tenant
   index is now usable under the policy, so the earlier planner note (a sequential scan
   forced by the old text comparison) is resolved as well — see
   [`report/EVIDENCE.md`](report/EVIDENCE.md#31-index-inventory).
4. **`seed_demo` not idempotent across tenants** (**D12**) — now fixed: the guard checks
   both the per-tenant and the global `users_email_key` constraint and reports a
   cross-tenant clash instead of raising. Note that `seed_demo` only creates the tenant and
   its superuser; `seed_atbu` and `seed_atbu_lecturers` build the academic structure, and
   the resource corpus comes from operating the app. See
   [`report/EVIDENCE.md` §6](report/EVIDENCE.md#6-seed-data-used-for-verification) for the
   origin of every count.
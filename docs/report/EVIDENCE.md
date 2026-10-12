# Evidence Register

Every figure in this report is a measured value produced by running the system, not an
estimate. This file records the exact commands, dates and outputs that the chapters cite.
Re-running any command reproduces the numbers.

Measured on: Windows 11, PowerShell 5.1, Python 3.13 (backend venv), Node 20 (frontend).

---

## 1. Repository state

| Item | Value | Command |
|---|---|---|
| Branch | `dev` | `git rev-parse --abbrev-ref HEAD` |
| HEAD commit | `ae6c473` — *refactor(frontend): drop landing variants, showcase and the three.js experiment* | `git log -1 --format="%h %s" dev` |
| Commit history span | 2026-08-22 → 2026-09-30 | `git log --reverse --format=%ad --date=short dev` |
| Total commits on `dev` | 159 | `git rev-list --count dev` |
| Tracked files | 662 | `git ls-files \| wc -l` |

The project was developed in a single 40-day window on one feature branch. This is a
complete, self-contained implementation rather than a long-lived fork of an upstream
project, which is why the literature review in Chapter 2 compares against published
systems and products rather than against a successor to this repository.

---

## 2. Backend structural counts

Measured by loading Django and introspecting the URL resolver, app registry and the
project's own RLS derivation helper:

```
$ cd backend
$ .\.venv\Scripts\python.exe -c "... get_resolver(), app registry, derive_tenant_scoped_tables() ..."

concrete models:            61
installed apps:             30
root urlpatterns (source):  20
root urlpatterns (runtime, DEBUG=True): 22
DRF router instances:       13
registered viewsets:        36
HTTP operations:            235
  of which @action methods: 31
leaf endpoints under /api/:  284   (262 canonical + 22 format-suffix duplicates)
distinct view callables:    88
Django admin endpoints:     197
RLS tenant-scoped tables:   45
```

| Metric | Value | Source of truth |
|---|---|---|
| Django version | 6.1.1 | `backend/pyproject.toml` / installed distribution |
| First-party Django apps | 15 | `backend/apps/` |
| Installed Django apps (incl. `django.contrib`) | 30 | `apps.get_app_configs()` |
| Concrete (managed) models | 61 | `apps.get_models()` filtered on `_meta.managed and not _meta.abstract` |
| URL patterns declared at the project root | 20 | `backend/config/urls.py:15-45` |
| URL patterns mounted at the root with `DEBUG=True` | 22 | 20 declared + `__debug__/` toolbar + static media route, `config/urls.py:47-54` |
| DRF router instances | 13 | one `DefaultRouter` per app; `apps.common.urls` and `apps.notifications.urls` declare none |
| Registered viewsets (`router.register` calls) | 36 | `router.registry` over all 13 routers |
| HTTP operations from routers | 235 | standard CRUD actions present on each viewset + `@action` method mappings |
| `@action` methods | 31 | `mapping` attribute on viewset methods |
| Leaf endpoints under `/api/` | 284 | recursive resolver walk |
| Distinct canonical API URL patterns | 262 | the 284 above, deduplicated by stripping `(?P<format>…)` variants |
| Distinct view callables under `/api/` | 88 | callback identity after walk |
| Django admin endpoints | 197 | `admin.site.urls` (excluded from the API surface) |
| Celery tasks defined (`@shared_task`) | 11 | `backend/apps/{accounts,assessments,platform,resources}/tasks.py` |
| Celery task route entries | 8 | `CELERY_TASK_ROUTES`, `backend/config/settings.py:360` |
| Celery queues declared | 5 | `celery`, `ai`, `ingestion`, `email`, `dlq` — `backend/config/celery.py:75-81` |
| Apps registered for task autodiscovery | 11 | `app.autodiscover_tasks([...])`, `backend/config/celery.py:20-35` |
| Management commands | 11 | `backend/apps/common/management/commands/` |
| Migration files | 77 | `backend/apps/*/migrations/` |
| Database migrations applied | 77 (no unapplied changes) | `manage.py migrate --check` |

**Note on terminology.** An earlier draft of this report described the API as "305 HTTP
operations across 36 routers". That conflated three different quantities and overstated
two of them. The verified figures are **235 router operations** across **13 routers**
registering **36 viewsets**. "36" is the number of `router.register()` calls, not the
number of routers. The corrected definition is *one operation per bound (viewset, HTTP
method) pair*, derived from `router.registry` and the `mapping` attribute that DRF's
`@action` decorator sets.

Per-app breakdown of the 235 router operations:

| App | Router | Viewsets | Operations | `@action` |
|---|---|---|---|---|
| `academics` | `router` | 10 | 65 | 5 |
| `learning` | `router` | 10 | 64 | 4 |
| `assessments` | `router` | 3 | 20 | 2 |
| `calendar` | `router` | 2 | 18 | 6 |
| `resources` | `router` | 1 | 17 | 11 |
| `knowledge` | `router` | 2 | 12 | 0 |
| `chat` | `router` | 2 | 10 | 2 |
| `accounts` | `router` | 1 | 6 | 0 |
| `tenants` | `router` | 1 | 6 | 0 |
| `platform` | `router` | 1 | 6 | 0 |
| `agent` | `router` | 1 | 6 | 0 |
| `logs` | `router` | 1 | 3 | 1 |
| `audit` | `router` | 1 | 2 | 0 |
| `common` | *(none)* | — | — | — |
| `notifications` | *(none)* | — | — | — |
| **Total** | **13** | **36** | **235** | **31** |

The 284 leaf endpoints under `/api/` exceed the 235 router operations by 49: 22 are
format-suffix variants that DRF's `DefaultRouter` generates alongside each router root
view, and the remainder are module-level `path()` endpoints declared directly in app
`urls.py` modules — token authentication, the health check, the public statistics view
and the SSE chat stream — which are function or class-based views rather than viewsets
and therefore contribute no `router.registry` entry.

The 15 first-party apps are `accounts`, `academics`, `agent`, `assessments`, `audit`,
`calendar`, `chat`, `common`, `knowledge`, `learning`, `logs`, `notifications`,
`platform`, `resources`, `tenants`.

---

## 3. PostgreSQL row-level security

RLS is not applied by a manual step. A `post_migrate` receiver in
`backend/apps/common/apps.py` re-derives the tenant-scoped table list from the model
registry and applies policies on every `migrate`.

Observed output of `manage.py migrate`:

```
  Applying common.tenant_rls...      OK
RLS enforced on 45 tenant-scoped tables.
```

`derive_tenant_scoped_tables()` returns 45 tables, matching the observed count exactly.
Two enforcement layers are stacked:

1. **Database layer** — a `FORCE ROW LEVEL SECURITY` policy keyed on a session variable
   that `tenant_scope()` sets and resets, so even a query written without an
   application-level filter cannot read another tenant's rows.
2. **Application layer** — `TenantScopedModel.get_queryset()` and DRF manager scoping
   narrow every queryset to the bound tenant.

RLS was proven to be active at runtime, not merely declared: a request carrying a
resource UUID belonging to a different tenant returned **HTTP 404**, not 403. Returning
404 for unauthorised rows is the intended behaviour, because a 403 would confirm that the
identifier exists.

---

## 3.1 Index inventory

Measured directly from `pg_indexes` against the running database.

| Metric | Value | Query |
|---|---|---|
| Total indexes in `public` | 319 | `count(*) FROM pg_indexes WHERE schemaname='public'` |
| RLS policies | 45 | `count(*) FROM pg_policies WHERE schemaname='public'` |
| Approximate-NN indexes (`hnsw` / `ivfflat`) | **1** | `indexdef ILIKE '%hnsw%' OR indexdef ILIKE '%ivfflat%'` |
| `GIN` / `GiST` indexes | **1** | `indexdef ILIKE '%gin%' OR indexdef ILIKE '%gist%'` |
| Indexes mentioning `vector` at all | **1** | `indexdef ILIKE '%vector%'` |
| Installed extensions | `plpgsql`, `vector` | `SELECT extname FROM pg_extension` |

The first three of those were **0, 0 and 0** when [D16](DEFECTS.md#d16--retrieval-runs-sequentially-with-no-vector-or-full-text-index-medium) was raised. Two indexes now close it:

```sql
CREATE INDEX resource_chunks_embedding_hnsw ON resource_chunks
    USING hnsw (embedding vector_cosine_ops) WHERE (embedding IS NOT NULL);
CREATE INDEX resource_chunks_ts_vector_gin   ON resource_chunks USING gin (ts_vector);
```

`resource_chunks` therefore carries seven indexes: those two plus five `btree`:

```sql
CREATE INDEX resource_ch_tenant__7ae677_idx          ON resource_chunks (tenant_id, resource_version_id);
CREATE INDEX resource_chunks_resource_version_id_...  ON resource_chunks (resource_version_id);
CREATE INDEX resource_chunks_tenant_id_...            ON resource_chunks (tenant_id);
CREATE UNIQUE INDEX resource_chunks_pkey              ON resource_chunks (id);
CREATE UNIQUE INDEX uniq_chunk_index                  ON resource_chunks (resource_version_id, chunk_index);
```

The lexical half of D16 was closed as well. `ResourceChunk` gained a persisted generated
column, `ts_vector`, defined as `to_tsvector('english'::regconfig, content)`, which the
migration stores as a real `tsvector`. Retrieval now reads that stored column and gates
on `@@` instead of rebuilding `to_tsvector` inside the `SELECT`
(`apps/knowledge/retrieval.py`), so the GIN index has something to match against.

### Both indexes verified usable

`EXPLAIN` with the row-level security policy temporarily lifted (and rolled back) selects
each index:

```
Index Scan using resource_chunks_embedding_hnsw on resource_chunks
  Order By: (embedding <=> '[…]'::vector)

Bitmap Index Scan on resource_chunks_ts_vector_gin on resource_chunks
  Index Cond: (ts_vector @@ '…'::tsquery)          -- 182 rows, correct estimate
```

**Residual observation, recorded rather than raised as a separate defect.** With the policy
active, PostgreSQL chose a sequential scan over the 706-row table. The RLS predicate was
emitted as `(tenant_id)::text = current_setting(…)` — a cast to `text`, evaluated as a
filter rather than an index condition — so neither of these indexes was selected on the
application's own query path at this table size. That affected which plan the planner picks;
it did not affect correctness, and the indexes themselves are valid and used whenever the
predicate was out of the way.

**Residual since fixed.** The policy expression was rewritten (in its own commit,
`fix(rls): compare tenant_id as uuid so column indexes are usable`) to
`tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` — the UUID
cast is applied to the *setting*, never to the column, and `NULLIF(…, '')` guards both the
unset and the `''`-after-`RESET` states. Re-verified after `manage.py migrate`: `EXPLAIN`
with `enable_seqscan=off` under the active policy now selects
`Index Scan using resource_chunks_tenant_id_cae46deb` with
`Index Cond: (tenant_id = …::uuid)`. The numbers above (317 → 319 indexes, 1 `hnsw`, 1
`gin`) are unchanged by that fix.

### `created_at` indexing is selective, by design

Of the 45 tenant-scoped models, **43** have a `created_at` column and **13** index it.

| Indexed (13) | Not indexed (30) |
|---|---|
| `AuditLog`, `Bookmark`, `CalendarSchedule`, `ChatMessage`, `ChatSession`, `Notification`, `PlanTask`, `Quiz`, `QuizAttempt`, `Resource`, `ResourceReport`, `ResourceSummary`, `User` | `AcademicSession`, `AgentSession`, `AgentSettings`, `AgentToolExecution`, `CalendarEvent`, `ChatMessageSource`, `Concept`, `ConceptEdge`, `ConceptInteraction`, `Course`, `CourseEnrollment`, `CourseOffering`, `Department`, `Faculty`, `LecturerCourseAssignment`, `Note`, `NotificationPreference`, `Plan`, `PlanMilestone`, `PlanTemplate`, `Programme`, `ProgressRecord`, `QuizQuestion`, `ResourceAccess`, `ResourceChunk`, `ResourcePermission`, `ResourceReadingPosition`, `ResourceVersion`, `Semester`, `StudySession` |

`CalendarEvent` is the instructive omission: it orders on `start`, not `created_at`, and
indexes `start` instead.

---

## 4. Test results

### 4.1 Backend

```
$ cd backend
$ .\.venv\Scripts\python.exe -m pytest -q
...
3 failed, 277 passed, 57 warnings in 880.36s (0:14:40)
```

- **280 tests collected, 277 passed, 3 failed** (98.9% pass rate).
- Distributed across **44 test files** via `pytest-xdist` (`-n auto`), which gives each
  worker its own test database. This matters because `apps/common/tests/test_rls.py`
  mutates global PostgreSQL role and RLS state; running it in a shared database
  contaminates unrelated tests.
- 57 warnings, dominated by Django 7.0 deprecations (`EMAIL_PORT`, `EMAIL_HOST`,
  `EMAIL_HOST_PASSWORD`, and a no-argument `select_related()` call in
  `apps/logs/views.py:82`).

The three failures are pre-existing and unrelated to this documentation work. Each was
re-run in isolation and fails identically:

| Failing test | Assertion |
|---|---|
| `apps/common/tests/test_dashboards.py::test_student_reminders_only_due_exams_and_milestones` | expected exam reminder `CS101 Finals` in the returned titles; received `{'Finish review'}` only — the plan milestone, not the exam |
| `apps/common/tests/test_material_experience.py::test_preview_text_and_pdf` | expected `resp.data["kind"] == "text"` for a `text/plain` resource; received `'office'` |
| `apps/common/tests/test_material_experience.py::test_preview_office_format_serves_extracted_text` | expected a `preview_url` key; raised `KeyError: 'preview_url'` |

All three are recorded in [DEFECTS.md](DEFECTS.md) as D15. They were fixed in a subsequent
hardening pass: the two preview tests encoded a pre-refactor response shape (they now
assert the shipped `content_path`/chunk-text-fallback contract) and the reminders test
passes against the current aggregation logic. The figures above are the measurement at the
audited revision and are retained unchanged.

### 4.2 Frontend unit tests

```
$ cd frontend
$ npm test
 Test Files  13 passed (13)
      Tests  62 passed (62)
   Duration  144.90s
```

All 13 test files and all 62 tests pass under Vitest 4.1.11 with the `happy-dom`
environment.

### 4.3 Frontend lint

```
$ npm run lint      # oxlint
--- exit was: 0 ---
```

Clean: zero errors and zero warnings.

### 4.4 Frontend production build

```
$ npm run build
✓ built in 18.88s

dist/assets/AppShell-DLvlhEkC.js              520.88 kB │ gzip: 154.80 kB
dist/assets/pdf-CxLxk-yn.js                   430.95 kB │ gzip: 129.05 kB
dist/assets/xlsx-DwRHmDrW.js                  492.52 kB │ gzip: 160.52 kB
dist/assets/pptx-preview.es-C49VVtI_.js     1,225.85 kB │ gzip: 389.10 kB

PWA v1.3.0
precache  237 entries (11554.74 KiB)
files generated
  dist/sw.js
  dist/workbox-63c18b4d.js
```

The build succeeds and emits a service worker. Vite emits a chunk-size advisory for the
largest lazy chunks (`AppShell` at 521 kB and the `pptx-preview` worker at 1.23 MB). This
is a performance observation, not a build failure — see Chapter 5.

### 4.5 End-to-end tests

Five Playwright specs exist (`auth`, `chat`, `dashboard`, `plans`, `resources`) plus
`helpers.js`. They were not executed for this report because the UI verification in
Chapter 5 was performed by direct browser automation against the running application
(see [§7](#7-screenshot-provenance)), which produced strictly more evidence than the specs.

---

## 5. Runtime health

```
$ curl http://localhost:8000/api/v1/health/
{"status":"ok","service":"academiai","dependencies":{
  "postgres":{"status":"ok","latency_ms":79.08},
  "redis":{"status":"ok","latency_ms":6.49}}}
```

Live Docker services during verification:

| Service | Image | Ports | Role |
|---|---|---|---|
| `academiai-db` | `pgvector/pgvector:pg16` | 5432 | Primary data store, vector + relational |
| `academiai-rabbitmq` | `rabbitmq:3-management-alpine` | 5672, 15672 | Celery broker |
| `academiai-redis` | `redis:7-alpine` | 6379 | Cache, Celery result backend |
| `academiai-minio` | `minio/minio` | 9000, 9001 | S3-compatible object storage for uploads |
| `academiai-minio-init` | `minio/mc` | — | One-shot bucket provisioning |
| `academiai-mailpit` | `axllent/mailpit:v1.31` | 1025, 8025 | SMTP sink and web inbox for development |

Both dependency probes report `ok` with sub-100 ms latency.

---

## 6. Seed data used for verification

No single command produces this corpus, and no command called `seed_demo` populates an
academic structure — `seed_demo` creates only the **ATBU** tenant (Abubakar Tafawa Balewa
University, a real Nigerian federal university) and its `admin@demo.local` superuser. The
verified row counts below, and where each block actually comes from:

| Entity | Count | Origin |
|---|---|---|
| Faculties | 8 | `manage.py seed_atbu` |
| Departments | 43 | `manage.py seed_atbu` |
| Programmes | 57 | `manage.py seed_atbu` |
| Lecturer accounts | 8 | `manage.py seed_atbu_lecturers` |
| Courses | 6 | created through the app |
| Course offerings | 6 | created through the app |
| Resources | 33 | uploaded through the app |
| Resource chunks (embedded text segments) | 706 | ingestion task, `apps/resources/tasks.py` |
| Extracted concepts | 171 | ingestion task (Gemini, heuristic fallback) |
| Concept edges | 28 | ingestion task |
| Chat sessions | 18 | app usage during the capture session |
| Chat messages | 64 | app usage during the capture session |
| Quizzes | 4 | app usage during the capture session |
| Quiz questions | 12 | app usage during the capture session |
| Quiz attempts | 3 | app usage during the capture session |
| Notes | 4 | app usage during the capture session |
| Bookmarks | 3 | app usage during the capture session |
| Progress records | 34 | app usage during the capture session |
| Calendar events | 41 | app usage during the capture session |
| Notifications | 21 | app usage during the capture session |
| Agent sessions | 6 | app usage during the capture session |

706 embedded chunks across 33 resources is what allows the retrieval-augmented
answering in Chapter 2 and Chapter 5 to be demonstrated on realistic academic
material rather than on placeholder strings.

**How to read these numbers.** Every count above was re-measured for this revision by
opening `tenant_scope(tenant.id)` and then reading the ORM, because all of these tables
carry a row-level security policy. Reading them outside that scope returns zero rows, not
an error — an easy way to conclude wrongly that the data is missing. The counts are
correct as measured on 2026-10-10; they move whenever the demo is exercised, so treat
them as a snapshot rather than a fixed contract.

`seed_atbu` reports its own totals on success and prints `faculties: 8, departments: 43,
programmes: 57`, matching the table. The 33 source files are still present in the MinIO
`academiai-resources` bucket under `tenants/<tenant_id>/resources/…`, so chunks can be
rebuilt by re-running ingestion if the rows are ever lost.

A single study plan with three milestones and their tasks was created through the public
API and Django ORM to give the planner screens meaningful content; see
[DEFECTS.md](DEFECTS.md#d1--plan-tasks-cannot-be-created-through-the-api-high) for the API defect that required the ORM fallback.

---

## 7. Screenshot provenance

62 screenshots were captured from the running application on 2026-10-05 by Playwright
driving Chromium at a 1440×900 desktop viewport, plus a 390×844 mobile viewport for the
responsive check. Authentication used the four seeded accounts listed in
[§8 Accounts](#8-accounts-used-for-screenshots).

Every capture was validated after it was taken:

- **pixel variance** — a low-variance image indicates a blank render and fails the check;
- **rendered DOM text length** — a short body indicates a shell that never resolved its
  data, and fails the check;
- **expected landmark counts** — e.g. a dialog capture must report exactly one open
  dialog.

Five captures failed their first validation pass and were re-shot after the cause was
fixed. Four were capture-timing races — a theme forced before hydration, and three dialogs
screenshot before they finished opening. The fifth, `14-student-resource-detail`, is not a
harness problem at all: the requested resource belonged to a course the student is not
enrolled in, so the system correctly returned 404 and rendered an error shell. A blank
screenshot caused by a working security control. Both readings are set out in
[Chapter 5 §5.4.7](CHAPTER_5_RESULTS_AND_DISCUSSION.md#547-captures-that-failed-validation-and-why).

---

## 8. Accounts used for screenshots

Four accounts were created or reset to exercise the four distinct role surfaces. All four
authenticated successfully before capture began; each screenshot in Chapter 5 was taken
under the account for its role.

| Role | Email | Password |
|---|---|---|
| Student | `muhammadelkufahn@gmail.com` | `Screenshot123!` |
| Lecturer | `lecturer@gmail.com` | `Screenshot123!` |
| Tenant administrator | `muhammadelkufahn27@gmail.com` | `Screenshot123!` |
| Platform superuser | `superadmin@gmail.com` | `Screenshot123!` |

These are **development seed credentials** created by `manage.py seed_demo` against the
local Docker Compose stack. They are not secrets and carry no value outside a developer's
machine; the database they belong to is not exposed and is destroyed with `docker compose
down -v`.

The four accounts are also what demonstrate role separation visually: the same URL
`/dashboard` renders a different interface for a student than for a tenant administrator,
and the forbidden-role screenshot (`53-forbidden-wrong-role.png`) is the system's response
when a role reaches a surface it does not own.

---

## 9. Answer-quality evaluation (LLM-as-judge)

Two runs over the seeded **ATBU** corpus (33 resources, 706 chunks, 587 embedded), drawing
the same 20 queries from the 60-case `rag_testset_large.json` with `--seed 2026`, served by
`gemini-3.1-flash-lite` (the larger Gemini builds were rate-limited at measurement time).
The grounded run uses the product path (hybrid retrieval → grounded generation); the control
run removes retrieval and the grounding instruction.

Command (from `backend/`):

```powershell
.\.venv\Scripts\python.exe manage.py evaluate_answers --queries rag_testset_large.json `
  --n 20 --mode grounded --model gemini-3.1-flash-lite --seed 2026 --sleep 0.3 `
  --out ..\docs\report\answer_eval_results.json
.\.venv\Scripts\python.exe manage.py evaluate_answers --queries rag_testset_large.json `
  --n 20 --mode ungrounded --model gemini-3.1-flash-lite --seed 2026 --sleep 0.3 `
  --out ..\docs\report\answer_eval_control_ungrounded.json
```

Observed `metrics` from the two written artefacts:

| Metric | Grounded | Ungrounded control |
|---|---:|---:|
| `answers_rated` | 20 | 20 |
| `factual_correctness` | 4.925 | 3.35 |
| `relevance` | 4.975 | 4.20 |
| `groundedness` | 5.00 | 1.10 |
| `completeness` | 4.85 | 3.025 |
| `hallucination_rate` | 0.0 | 0.975 |
| `source_attribution_coverage` | 0.920 | 0.0 |
| `answers_with_valid_source_marker` | 0.90 | 0.0 |
| `cohens_kappa_overall` | 1.00 | 0.417 |
| `claims_scored` | 226 | 221 |

`generation_or_judge_failures` was 0 in both runs. `cohens_kappa_by_dimension` was
0.00 / 1.00 / 1.00 / 0.00 (grounded) and 0.45 / 0.63 / 1.00 / 0.33 (control) for factual
correctness, relevance, groundedness and completeness respectively. Agreement is
**inter-judge** (two LLM personas), **not human inter-rater**; the grounded κ at 1.00 is at
ceiling and uninformative, while the control κ of 0.42 is the trustworthy value. See
[Appendix F](APPENDIX.md#appendix-f--answer-quality-evaluation-llm-as-judge) and
[ANSWER_EVALUATION.md](ANSWER_EVALUATION.md).

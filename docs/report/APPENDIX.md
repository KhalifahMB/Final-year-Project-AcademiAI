# Appendix — System Usability Scale Questionnaire and Supporting Material

---

## Appendix A — System Usability Scale (SUS)

### A.1 Status

**This questionnaire has not been administered. No responses have been collected, and no
usability score is reported anywhere in this document.**

It is included in a complete, ready-to-administer form so that the evaluation described in
[Chapter 5 §5.7](CHAPTER_5_RESULTS_AND_DISCUSSION.md#57-user-study-instrument-and-status)
can be conducted. The analysis tables in Chapter 5 are deliberately left empty.

Earlier drafts of this project's documentation contained a SUS results section. On
inspection, those drafts stated that no study had been conducted. This appendix therefore
reports an **instrument**, not **data**.

### A.2 Instrument selection

The **System Usability Scale** is used (Brooke, 1996), with normative reference data and
adjective-rating bands from Bangor, Kortum and Miller (2008).

| Property | Value for this study |
|---|---|
| Items | 10 Likert items, 5 response options each |
| Administration time | Under two minutes |
| Output | One score, 0–100 |
| Validation basis | Analysis of nearly a decade of SUS data across many products (Bangor et al., 2008) |
| Interpretation | Normative distribution and adjective bands available |
| Chosen because | Standard, brief, produces an interpretable score, and is the benchmark against which a usability claim will be judged |

### A.3 Questionnaire items

Present the ten items together. Ask the respondent to think about their most recent use of
the system.

**Response scale for every item:**

```
Strongly disagree    Disagree    Neutral    Agree    Strongly agree
    1                   2          3          4           5
```

| # | Item | Domain |
|---|---|---|
| 1 | I would like to use this system more often. | Usability |
| 2 | I found the system unnecessarily complex. | Complexity |
| 3 | I thought the system was easy to use. | Usability |
| 4 | I think that I would need technical support in order to use this system well. | Support |
| 5 | I thought the system was nicely organized. | Usability |
| 6 | I thought the system was too complicated. | Complexity |
| 7 | I would imagine that most students would learn to use this system very quickly. | Learnability |
| 8 | I found the system awkward to use. | Complexity |
| 9 | I felt confident using the system. | Operability |
| 10 | I needed to learn a lot of things before I could get going with this system. | Learnability |

Items 2, 4, 6, 8 and 10 are worded negatively and **must be inverted** before scoring.
Getting this wrong is the most common error in SUS administration.

### A.4 Scoring procedure

For each respondent:

1. For **odd-numbered items** (1, 3, 5, 7, 9): `score − 1`
2. For **even-numbered items** (2, 4, 6, 8, 10): `5 − score`
3. Sum the ten transformed values. Range: 0–50.
4. Multiply the sum by **2.4**. Result: **0–100**.

**Worked example.** A respondent scores 4, 2, 4, 2, 5, 2, 4, 2, 4, 2:

```
Odd items  (1,3,5,7,9):  (4-1)+(4-1)+(5-1)+(4-1)+(4-1) = 3+3+4+3+3 = 16
Even items (2,4,6,8,10): (5-2)+(5-2)+(5-2)+(5-2)+(5-2) = 3+3+3+3+3 = 15
Sum = 16 + 15 = 31
SUS = 31 × 2.4 = 74.4  →  "Excellent"
```

### A.5 Interpretation bands

From Bangor et al. (2008). These are fixed reference values, not measurements.

| SUS range | Adjective rating |
|---|---|
| 0 – 25 | Worst imaginable |
| 26 – 38 | Poor |
| 39 – 52 | OK |
| 53 – 72 | Good |
| 73 – 85 | Excellent |
| 86 – 100 | Best imaginable |

### A.6 Sampling plan

Stratified by role, because the four roles encounter materially different interfaces.

| Stratum | Target n | Surfaces exercised |
|---|---|---|
| Students | 30 | Chat, resources, plans, calendar, quizzes, notes, progress |
| Lecturers | 15 | Assigned courses, quiz drafting, course analytics |
| Tenant administrators | 10 | Structure, users, courses, audit, templates, timetable |
| Platform superusers | 5 | Tenants, requests, analytics, health, platform audit |
| **Total** | **60** | — |

**Administration protocol.** Each participant must have used the system for at least one
session before completing the questionnaire; SUS measures perceived usability of an actual
experience, and administering it to a first-time user measures something else. Record the
stratum, the participant's frequency of use, and their role. Do not prompt participants
toward any response.

### A.7 Analysis plan

1. Report **mean, standard deviation, median and interquartile range** per stratum.
2. Compare each stratum against the normative mean with a **95% confidence interval**.
3. Interpret each stratum mean against the bands in A.5.
4. For the platform-superuser stratum (n = 5), report **individual scores only**. Five
   observations do not support an inferential claim, and presenting a mean with a
   standard deviation would overstate the precision of the data.
5. Cross-tabulate item-level means against the item's domain (A.3) to locate usability
   problems — a low overall score with one low domain identifies where to fix.

### A.8 Reporting template — to be completed after administration

| Stratum | Target n | Responses | Mean | SD | Median | IQR | Band |
|---|---|---|---|---|---|---|---|
| Students | 30 | | | | | | |
| Lecturers | 15 | | | | | | |
| Tenant administrators | 10 | | | | | | |
| Platform superusers | 5 | | | | | | |
| **All respondents** | **60** | | | | | | |

---

## Appendix B — Glossary of Domain Terms

| Term | Definition in this system |
|---|---|
| **Tenant** | One institution. The root of the isolation model. All tenant-scoped rows carry a `tenant_id`. |
| **Tenant scoping** | Restricting every query to the requesting user's tenant. Enforced by RLS, a `TenantScopedModel` queryset default, and DRF permissions. |
| **Row-level security (RLS)** | A PostgreSQL feature that filters rows by a policy evaluated in the database, applying to every client including raw SQL. |
| **`tenant_scope()`** | A context manager that binds the current tenant for the duration of a request or a Celery task and resets it afterwards. |
| **Course offering** | A course taught in a specific semester of a specific academic session. The granularity at which lecturer authority and student entitlement are enforced. |
| **Visibility scope** | Who may read a resource: `private`, `course`, `programme`, `department`, `faculty`, `institution`. |
| **Chunk** | A segment of a document's text, stored with an embedding vector. Retrieval operates on chunks, not documents. |
| **Concept** | An academic topic extracted from the corpus during ingestion, forming a node in the concept graph. |
| **Concept edge** | A typed relation between two concepts, used to expand retrieval one hop. |
| **Hybrid retrieval** | Combining dense vector, sparse lexical and concept-graph results into one ranked list. |
| **RRF** | Reciprocal Rank Fusion. Rank-only combination, `Σ 1/(k + rank)`, with `k = 60` here. |
| **Grounded answer** | An answer composed only from retrieved passages the requester is authorised to read. |
| **Citation** | A reference from a claim to the specific `ResourceChunk` that supports it. |
| **Confidence** | A label derived from supporting chunk count: `high` (≥3), `medium` (1–2), `low` (0). `low` means the corpus did not support the answer. |
| **Ingestion** | Asynchronous conversion of an upload into extracted text, chunks, embeddings and concepts. |
| **`READY`** | A resource whose chunks, embeddings and concepts have all committed. Retrieval never sees a partially ingested document. |
| **Dead-letter queue** | The `dlq` queue that retains asynchronously failed work for inspection instead of dropping it. |
| **Milestone** | A dated goal within a study plan. Tasks belong to milestones. |
| **Cohort signal** | An aggregate derived from quiz results and student questions — for example concept confusion — shown to lecturers. Excludes staff activity. |
| **Guard** | A frontend route wrapper that redirects on authentication state or role and renders the forbidden state on mismatch. |

---

## Appendix C — Requirement Traceability Matrix

Maps each stated objective to its implementing module, its evidence, and its status.

| Objective | Requirements | Primary implementation | Evidence | Status |
|---|---|---|---|---|
| **O1** Isolation | FR-001…005, NFR-001, 002, 011 | `apps/common/models.py`, `apps/common/rls.py`, `apps/common/db.py`, `infrastructure/postgres/init/01-app-role.sql` | 45 tables policied; runtime 404 vs 200 | Achieved |
| **O2** Academic structure | FR-010…014 | `apps/academics/` (10 models) | 8 faculties, 43 depts, 57 programmes seeded | Achieved |
| **O3** Ingestion | FR-030…039, NFR-006…008 | `apps/resources/tasks.py`, `summary_tasks.py` | 706 chunks, 171 concepts, 28 edges | Achieved |
| **O4** Hybrid retrieval | FR-040…047, NFR-003, 014, 015 | `apps/knowledge/retrieval.py`, `apps/chat/services/retrieval.py` | Authorisation-first flow verified; ranking quality unmeasured | Achieved |
| **O5** Cited answers | FR-043…055, NFR-016 | `apps/chat/`, `apps/agent/` | Per-chunk citations verified; agentic chain partially verified | Partially achieved |
| **O6** Study workflow | FR-060…070, 080…084 | `apps/learning/`, `apps/calendar/`, `apps/assessments/` | 4 calendar views verified; plan-task API and timetable import broken | Partially achieved |
| **O7** Evaluation | NFR-020…022, 027 | `backend/`, `frontend/`, Playwright capture | 277/280 backend, 62/62 frontend, lint and build clean; instrument unadministered | Partially achieved |

---

## Appendix D — Reproducing the Reported Results

### D.1 Environment

| Requirement | Detail |
|---|---|
| OS | Windows 11 (verified); Linux expected for production |
| Python | 3.13 in `backend/.venv` |
| Node | 20 |
| Docker | Docker Compose with the six services in [EVIDENCE §5](EVIDENCE.md#5-runtime-health) |

### D.2 Backend

```powershell
cd backend
docker compose up -d
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo           # tenant + superuser
.\.venv\Scripts\python.exe manage.py seed_atbu           # 8 faculties, 43 departments, 57 programmes
.\.venv\Scripts\python.exe manage.py seed_atbu_lecturers # 8 lecturer accounts
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe manage.py runserver
```

`migrate` prints `RLS enforced on 45 tenant-scoped tables.` — this is the first
verification that isolation is active.

No command seeds the whole corpus. The resources, chunks, concepts, chat, quizzes and
plan data used throughout this report came from operating the application; each count in
[EVIDENCE §6](EVIDENCE.md#6-seed-data-used-for-verification) names its own origin.

> **Note (D12, now fixed).** `seed_demo` used to fail when the seed address was already
> owned by a *different* tenant, because `users.email` carries a global unique constraint
> while the guard only checked per tenant. The guard now reports that clash instead of
> raising. The seeders also bind the tenant themselves with `tenant_scope()`, without
> which `seed_atbu` and `seed_atbu_lecturers` are blocked by row-level security.

### D.3 Frontend

```powershell
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run lint
npm test
npm run build
```

### D.4 Celery worker

```powershell
cd backend
.\.venv\Scripts\python.exe -m celery -A config worker -l info
```

On Windows the worker automatically selects the `solo` pool because `billiard`'s prefork
pool depends on POSIX semaphores and crashes on `win32`. This is configured in
`backend/config/celery.py` and is intentional.

### D.5 Verifying the isolation claim manually

This is the check from [Chapter 5 §5.3.2](CHAPTER_5_RESULTS_AND_DISCUSSION.md#532-tenant-isolation-verified-at-runtime),
reproducible in three requests.

1. Log in as the seeded student.
2. `GET /api/v1/resources/<a UUID from another course>/preview/` → expect **404**.
3. `GET /api/v1/resources/<a UUID the student is enrolled in>/preview/` → expect **200**
   with a populated preview.

Step 2 returning 403 instead of 404 would indicate the endpoint is disclosing existence.
Step 2 returning 200 would indicate a broken isolation guarantee.

### D.6 Reproducing the reported defects

| Defect | Command | Expected |
|---|---|---|
| D1 | `POST /api/v1/plan-tasks/` as student | `500 IntegrityError` |
| D2 | `GET /api/schema/` | `500 TypeError` |
| D3 | `GET /api/v1/logs/?search=abc` as tenant admin | `500` |
| D6 | Open `/admin/upload` and attempt step 1 | No control advances the wizard |

Full reproduction steps and causes are in [DEFECTS.md](DEFECTS.md).

---

## Appendix E — Source of Every Number in This Report

| Claim | Source |
|---|---|
| 61 concrete models | Django app registry: `apps.get_models()`, `_meta.managed and not _meta.abstract` |
| 54 project tables + 7 contributed | `db_table` over managed models, split on `app_label` |
| 13 DRF routers, 36 registered viewsets | `router.registry` across `apps.*.urls`; `apps.common` and `apps.notifications` declare no router |
| 235 HTTP operations, 31 `@action` methods | one operation per bound (viewset, HTTP method) pair: standard CRUD actions present on the viewset + the `mapping` dict DRF's `@action` sets |
| 262 distinct canonical API URL patterns | recursive resolver walk over `config/urls.py`, deduplicated by stripping DRF `(?P<format>…)` variants from the 284 raw leaves |
| 20 root urlpatterns | `backend/config/urls.py:15-45` (22 at runtime, since `DEBUG=True` adds `__debug__/` and a static media route) |
| 45 RLS tables | `derive_tenant_scoped_tables()` and the `post_migrate` receiver's own output |
| 280 backend tests, 277 passed, 3 failed | `pytest -q` output, 880.36 s |
| 62 frontend tests, 13 files | `npm test` output, 144.90 s |
| Lint clean | `npm run lint` exit code 0 |
| Build 18.88 s, 237 precache entries | `npm run build` output |
| 159 commits, 2026-08-22 → 2026-09-30 | `git rev-list --count dev`, `git log` |
| 662 tracked files | `git ls-files` |
| PostgreSQL 79.08 ms, Redis 6.49 ms | `GET /api/v1/health/` |
| Seed row counts | `manage.py seed_atbu` / `seed_atbu_lecturers`, then counted inside `tenant_scope()` — see [EVIDENCE §6](EVIDENCE.md#6-seed-data-used-for-verification) for per-row origins |
| Index counts (319 total, 1 `hnsw`, 1 `GIN`) | `count(*) FROM pg_indexes` — see [EVIDENCE §3.1](EVIDENCE.md#31-index-inventory) |
| 62 screenshots | Playwright capture with per-capture pixel-variance, DOM-length and landmark validation |
| 27 architecture decisions | Headings in `docs/DECISIONS.md` |

Full command output is in [EVIDENCE.md](EVIDENCE.md).

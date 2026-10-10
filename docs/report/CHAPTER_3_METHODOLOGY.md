# Chapter Three — Methodology

---

## 3.1 Introduction

This chapter states the development methodology adopted for AcademiAI, applies it to
this specific project, and justifies the choice. The methodology determines how the
system was decomposed, in what order the parts were built, and how correctness was
argued. Because the research contribution of this project is an *architectural* claim —
that authorisation can be pushed into the retrieval pipeline and enforced by the database
— the methodology had to make architectural decisions explicit and traceable, not merely
produce working code.

---

## 3.2 Methodology Adopted

### 3.2.1 The adopted approach

AcademiAI was developed using an **incremental, specification-driven object-oriented
approach**, combining:

| Element | Application in this project |
|---|---|
| **Object-oriented analysis and design** | The domain was decomposed into bounded Django apps, each owning its models, and the institutional hierarchy was expressed as object relationships rather than ad-hoc joins. |
| **Incremental delivery** | 159 commits over 40 days, each a working increment, following Conventional Commits (`feat`, `fix`, `test`, `refactor`, `docs`). |
| **Specification-driven design** | Product requirements, architecture, design, database schema, threat model and API contracts were written as artefacts and revised as decisions were made. |
| **Architecture decision records** | 27 numbered decisions recorded in `docs/DECISIONS.md`, each with context, decision and consequence, so that a choice could be audited later rather than re-litigated or lost. |
| **Continuous testing** | 44 backend test files and 13 frontend test files are co-located with the code they test, so tests were written per increment rather than retrofitted. |
| **Evolutionary schema management** | 77 migrations record the schema's history, making every structural change reviewable and reversible. |

The process ran in five recurring phases per increment:

```
  Specify  →  Design  →  Implement  →  Verify  →  Record decision
     ↑                                                      │
     └──────────────────────────────────────────────────────┘
```

### 3.2.2 Methodologies considered and rejected

| Methodology | Why rejected |
|---|---|
| **Waterfall** | The central research question could not be settled by a requirements document. Whether authorisation-first retrieval is feasible depends on how pgvector, RLS and full-text search interact under a filter. That had to be discovered by building a slice and measuring it. A waterfall front-loads design certainty this project did not have. |
| **Pure extreme programming** | Appropriate, but unsuitable as the sole discipline here because the *security* argument — that a non-superuser role plus RLS makes cross-tenant reads impossible — is an architectural claim that must be stated, challenged and recorded, not merely continuously integrated. Pair programming cannot substitute for a written threat model. |
| **Spiral** | Heavier than warranted. The dominant risk in this project is *not* technical uncertainty in the classical sense; it is a single architectural question that can be settled in the first increment and then defended with tests. Spiral's risk-driven multi-loop structure adds process without reducing the real risk. |
| **DevOps / continuous delivery as a primary methodology** | Deployment pipeline practice is appropriate as a *supporting* discipline — which this project did adopt, via Docker Compose and a green test suite — but it is not a development methodology and does not decompose a domain. |
| **Feature-driven development** | Attractive for a system with 61 models and 235 operations, but its formalisation overhead (feature catalogue, cross-cutting concern matrices) would have exceeded the size of the problem. The incremental approach achieves the same decomposition with lighter ceremony. |

### 3.2.3 Why the combination was adopted

The project had one genuinely hard problem — **enforcing institutional authorisation
inside a retrieval pipeline** — and otherwise a large volume of ordinary, well-understood
CRUD surface. A methodology suited to the hard problem would be disproportionate for the
CRUD surface; a methodology suited to the CRUD surface would not force the hard problem to
be specified.

The combination resolves this. Object-oriented design handles decomposition at the
domain level (faculty ≠ department ≠ programme ≠ course ≠ offering). The specification
artefacts force the authorisation model to be written down before it is trusted. Incremental
delivery lets a thin vertical slice — upload one document, retrieve one chunk, cite it —
be built and measured early, which is what converted the architectural question from an
assumption into a verified property. Architecture decision records preserve *why*, which
matters because several load-bearing decisions in this project are not obvious from the
code alone.

---

## 3.3 Methodology Applied to This Project

### 3.3.1 System architecture

The system is a two-tier web application with an asynchronous processing tier.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                     │
│  React 19 SPA — 57 lazy-loaded route components                          │
│  AppShell · CommandPalette · NotificationInbox · FloatingAgent           │
└───────────────┬──────────────────────────────────┬───────────────────────┘
                │ REST (JWT Bearer)                │ SSE (token stream)
                ▼                                  ▲
┌──────────────────────────────────────────────────────────────────────────┐
│                    DJANGO REST FRAMEWORK BACKEND                         │
│                                                                          │
│  guards (route)     serializers / viewsets (36 viewsets, 235 ops)         │
│  permissions (role + object-level)          throttling                    │
│                                                                          │
│  ┌──────────────────── DOMAIN APPS (15) ──────────────────────────────┐  │
│  │ academics  tenants  accounts  learning  calendar  assessments      │  │
│  │ resources  knowledge chat     agent     audit    logs  notifications │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                          │                    │                         │
│         TenantScopedModel queryset default    hybrid_retrieve()          │
│         + DRF object permissions              (authorisation-first)     │
│                          │                    │                         │
│  ┌─────────────────────── CROSS-CUTTING ─────────────────────────────┐  │
│  │ tenant_scope()   RLS derivation   audit   notifications   agent    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────┬────────────────────────────┬───────────────────┬────────────────┘
         │ ORM                        │ enqueue           │ sign URL
         ▼                            ▼                   ▼
┌─────────────────┐        ┌──────────────────┐   ┌──────────────┐
│  PostgreSQL 16  │        │  Celery workers  │   │    MinIO     │
│  + pgvector     │        │  5 queues + DLQ  │   │  S3 objects  │
│  RLS on 45 tbls │        └────────┬─────────┘   └──────────────┘
│  exact cosine  │                 │
└─────────────────┘                 ▼
                           ┌──────────────────┐
                           │   Gemini API     │
                           │ embeddings + gen │
                           └──────────────────┘
```

Supporting services: **RabbitMQ** (broker), **Redis** (cache and result backend),
**Mailpit** (SMTP sink). All run under Docker Compose.

### 3.3.2 The retrieval flow — authorisation before ranking

This is the core flow of the system and the one the study contributes. It is
implemented in `backend/apps/knowledge/retrieval.py::hybrid_retrieve()` and
`backend/apps/chat/services/retrieval.py::retrieve_grounding_chunks()`.

```
                  ┌──────────────────────────────────────┐
                  │  Student submits a question         │
                  └──────────────────┬───────────────────┘
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  1. RESOLVE AUTHORISED RESOURCES      │
                  │  _authorized_resource_ids(user,       │  ◄── FIRST
                  │      course_offering_id)              │      STEP
                  │  · role → visibility scope            │
                  │  · enrolment / lecturer assignment    │
                  │  · PostgreSQL RLS filters the query   │
                  └──────────────────┬───────────────────┘
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  2. Cache lookup                      │
                  │  key = tenant + user + sha256(query) │  ◄── private
                  │  TTL = 300s                          │      chunks
                  └──────────────────┬───────────────────┘      cannot
                          hit      │      miss                  cross
                  ┌──────────────────┴───────────────────┐      users
                  ▼                                      ▼
   ┌──────────────────────────────┐      ┌──────────────────────────────┐
   │ 3a. DENSE  vector search     │      │ 3b. LEXICAL full-text search │
│ pgvector cosine, top-K       │      │ ts_rank, rank per row over   │
    │ over the authorised id set   │      │ SAME authorised id set       │
   └──────────────┬───────────────┘      └──────────────┬───────────────┘
                  │                                     │
   ┌──────────────┴───────────────┐                     │
   │ 3c. CONCEPT graph signal     │                     │
   │ match concept names in query │                     │
   │ expand ONE HOP over          │                     │
   │ ConceptEdge (limit 20)       │                     │
   │ → map to resources/chunks    │                     │
   └──────────────┬───────────────┘                     │
                  │                                     │
                  └──────────────┬──────────────────────┘
                                 ▼
                  ┌──────────────────────────────────────┐
                  │ 4. RRF FUSION                        │
                  │ score(d) = Σ  1 / (60 + rank)        │  ◄── k = 60
                  │ (Cormack et al., 2009)               │
                  └──────────────────┬───────────────────┘
                                     ▼
                  ┌──────────────────────────────────────┐
                  │ 5. FOLD ATTACHED RESOURCES           │
                  │ top 10 chunks per attached resource  │
                  └──────────────────┬───────────────────┘
                                     ▼
                  ┌──────────────────────────────────────┐
                  │ 6. CONFIDENCE HEURISTIC              │
                  │ ≥3 chunks = high · 1-2 = medium      │
                  │ 0 = low (general knowledge, honest)  │
                  └──────────────────┬───────────────────┘
                                     ▼
                  ┌──────────────────────────────────────┐
                  │ 7. GENERATE + CITE  (Gemini)         │
                  │ ≤24 chunks in context (RAG_MAX_      │
                  │ CONTEXT_CHUNKS) → answer + per-chunk │
                  │ citations → SSE stream to browser    │
                  └──────────────────────────────────────┘
```

**Step 1 is load-bearing.** The authorised resource set is computed *before* any ranking
occurs, and all three retrievers receive that set as a filter. Consequently no
unauthorised chunk can enter the fusion, cannot influence ranking, and cannot reach the
generator. This is the mechanism by which the system resists both the cross-tenant
leakage and the indirect prompt-injection vector identified in
[Chapter 2 §2.2.6](CHAPTER_2_LITERATURE_REVIEW.md#226-grounding-retrieval-in-an-authorisation-model).

**Step 2 caches per tenant *and* per user**, keyed on a SHA-256 digest of the query.
Including the user in the key is required: two students in the same tenant issuing the
identical question have different authorised sets, so a tenant-only cache key would serve
one student the other's private resource chunks.

**Step 4 uses `k = 60`** as established by Cormack et al. (2009). Because RRF consumes
only ranks, the dense, lexical and concept lists are fused without any score calibration.

**Step 6 makes ungrounded answers visible.** A zero-chunk result yields `low` confidence
and is labelled as answering from general knowledge rather than from the corpus, which is
how the product avoids presenting an unsupported claim as a grounded one.

### 3.3.3 The document ingestion flow

```
  Upload (MinIO presigned PUT)
      │
      ▼
  Resource row: processing_status = PENDING
      │  enqueue → Celery queue "ingestion"
      ▼
  ┌────────────────────────────────┐
  │ 1. _extract_text()             │  PDF / DOCX / XLSX / PPTX / TXT / MD
  │    → plain text                │  (no OCR — scanned images not read)
  ├────────────────────────────────┤
  │ 2. _simple_chunk()             │  overlap-aware segmentation
  │    → ResourceChunk rows        │
  ├────────────────────────────────┤
  │ 3. embed each chunk            │  → pgvector column
  ├────────────────────────────────┤
  │ 4. _extract_text/_persist_     │  model-assisted concept + edge
  │    concepts_and_edges()        │  extraction → Concept, ConceptEdge,
  │                                │  ResourceConcept
  ├────────────────────────────────┤
  │ 5. processing_status = READY   │
  └────────────────────────────────┘
      │
      ├──▶ queue "ai": summarize_resource_task (AI summary)
      └──▶ SSE notifies the browser; document is now retrievable
```

Every step commits within the transaction that made the document visible, so a resource
is never `READY` with partial embeddings. Ingestion is asynchronous because embedding a
document is too slow to hold an HTTP request open.

### 3.3.4 The agentic flow

Each in-tenant role has a dedicated agent with its own persona and its own tool set.

```
  User message
      │
      ▼
  resolve_agent_key(role)  ──▶  Study Partner (student)
                          ──▶  Course Co-pilot (lecturer)
                          ──▶  Institution Operator (tenant_admin)
      │
      ▼
  Build system context: role, tenant, sanitised profile
      │
      ▼
  Gemini function-calling loop
      │
      ├──── tool call ────▶ execute_tool(name, user, params)
      │                        │
      │                        └─ role boundary enforced INSIDE the tool:
      │                           student → CourseEnrollment
      │                           lecturer → LecturerCourseAssignment
      ▼
  Answer + VISIBLE tool-call chain streamed to the user
```

Nine tools are registered: `get_user_profile`, `get_user_courses`, `get_user_progress`,
`get_user_plans`, `create_plan`, `get_resource_summary`, `get_quiz_results`,
`get_deadlines`, `search_resources`.

Two properties matter for this study. First, the role boundary is enforced **inside each
tool**, not by which tools are advertised to the model — so a model that hallucinates a
tool call still cannot reach data outside the caller's role. Second, the tool-call chain is
rendered in the interface, so a user can inspect what the agent actually did rather than
taking the answer on trust. That visibility is a direct response to the trust requirement
in [Chapter 1 §1.1](CHAPTER_1_INTRODUCTION.md#11-background-of-the-study).

### 3.3.5 Development sequence as executed

The order in which capabilities were built follows the risk, not the feature list.

| Stage | Increment | Why here |
|---|---|---|
| 1 | Tenancy, users, auth, RLS | The architectural claim. If RLS could not be made binding, the project's premise failed and nothing else mattered. |
| 2 | Academic structure | Everything else references it: visibility, courses, offerings, analytics. |
| 3 | Resources + ingestion + retrieval | The core research contribution. |
| 4 | Chat, citations, agents | Depends on retrieval being trustworthy. |
| 5 | Study loop: planner, calendar, notes, progress, quizzes | Depends on chat. |
| 6 | Administration, audit, platform console | Depends on the domain being stable. |
| 7 | Hardening, test coverage, docs | Depends on there being something to harden. |

This ordering is the practical justification for incrementality over waterfall: stage 1
settled the research question with a working, testable slice, and stages 2-7 were
conventional build work that could proceed against a settled foundation.

---

## 3.4 Design and Development Tools

| Category | Tool | Version | Purpose |
|---|---|---|---|
| Language | Python | 3.13 | Backend and AI pipeline |
| Language | JavaScript (ES2022+) | — | Frontend and QA automation |
| Backend framework | Django | 6.1.1 | ORM, migrations, app registry, test client |
| REST framework | Django REST Framework | — | Serializers, viewsets, permissions, throttling |
| Schema generation | drf-spectacular | — | OpenAPI schema and Swagger UI |
| Frontend | React | 19 | Component model |
| Build tool | Vite | 8 | Dev server, production build, code splitting |
| Styling | Tailwind CSS | 4 (CSS-first) | Tokens in `index.css`, light/dark themes |
| Components | shadcn/ui (Radix) | — | Dialog, dropdown, tabs, switch primitives |
| Icons | lucide-react | — | Icon set |
| Database | PostgreSQL | 16 | Primary store, RLS, full-text search |
| Vector store | pgvector | — | Embeddings, with a partial `hnsw` index and cosine distance ordering ([D16](DEFECTS.md#d16--retrieval-runs-sequentially-with-no-vector-or-full-text-index-medium), since closed) |
| Task queue | Celery + RabbitMQ | — | Ingestion, summarisation, quiz generation, email |
| Cache | Redis | 7 | Retrieval cache, Celery result backend |
| Object storage | MinIO | — | S3-compatible uploads and signed previews |
| Email sink | Mailpit | 1.31 | Development SMTP and web inbox |
| Orchestration | Docker Compose | — | Six-service reproducible environment |
| Model provider | Gemini | — | Embeddings and answer generation |
| Backend tests | pytest + pytest-django + pytest-xdist | — | 280 tests, parallel per-worker databases |
| Frontend tests | Vitest + happy-dom | 4.1.11 | 62 tests |
| E2E / capture | Playwright (Chromium) | — | 5 specs; used to produce all 62 report screenshots |
| Lint | oxlint | — | Frontend static analysis |
| Version control | Git | — | 159 commits, Conventional Commits |
| Documentation | Markdown | — | Report and specifications |

---

## 3.5 Justification of the Adopted Methodology

The adopted approach is justified against the requirements this specific project placed on
its development process.

**1. The architectural claim had to be verifiable, not asserted.**
The project's contribution is that authorisation can be moved into the retrieval pipeline
and enforced by the database. Such a claim is worthless if it rests on inspection. The
incrementality made it testable: `apps/common/tests/test_rls.py` verifies policy coverage
across the derived table list, and the runtime check in
[Chapter 5 §5.3](CHAPTER_5_RESULTS_AND_DISCUSSION.md#532-tenant-isolation-verified-at-runtime)
demonstrates a cross-tenant identifier returning 404. An object-oriented, specification-led
waterfall would have produced the same policy text with no mechanism proving the app role
is actually subject to it.

**2. The domain is large enough to need explicit decomposition.**
61 models and 235 operations across 15 apps will not stay comprehensible without a stated
decomposition. Object-oriented analysis gave the boundary rule — one app per cohesive
aggregate (`learning` owns plans and progress; `calendar` owns events; `academics` owns
the institutional hierarchy) — and the app registry then makes that decomposition
*machine-readable*, which is what allows the RLS derivation to cover new models with no
manual step.

**3. The risk was concentrated, so early validation mattered more than early breadth.**
Building tenant isolation first meant the riskiest assumption was tested while the codebase
was small enough to change cheaply. Had the project built 57 screens first and discovered
that the app role had inherited superuser rights, the remediation would have been
materially more expensive.

**4. Decisions needed to survive their authors.**
Twenty-seven architecture decision records capture choices that the code does not explain
— why RLS is derived from the model registry, why the retrieval cache key includes the
user, why the test suite connects as a `BYPASSRLS` role only when gated by an environment
flag. These would otherwise have been re-litigated or silently undone.

**5. The incremental approach was honest about what was known.**
Building a vertical slice first, measuring it, and only then broadening is what produced
the honest findings in [Chapter 5](CHAPTER_5_RESULTS_AND_DISCUSSION.md) — including three
failing tests and a search endpoint that passes its own test suite but returns HTTP 500
when its optional parameter is used. A methodology that front-loaded specification
completeness would more likely have documented those endpoints as working.

**Where the methodology fell short.** Incremental delivery with a single author provides
no independent challenge to design decisions. The specification artefacts and the decision
record partly compensate, but a second reviewer would have caught defects D1-D6 earlier;
all six were found by writing this report's verification passes, not during the build. This
is recorded as a limitation rather than omitted.

---

**Next:** [Chapter Four — Analysis and Design](CHAPTER_4_ANALYSIS_AND_DESIGN.md)

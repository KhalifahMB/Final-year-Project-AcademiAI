# Chapter Four — Analysis and Design

---

## 4.1 Introduction

This chapter presents the analysis and design of AcademiAI: what the system must do
(functional requirements), what qualities it must possess (non-functional requirements),
who uses it (user requirements), what it is built from (system requirements), and how it
is modelled (UML and database design).

All figures in this chapter are derived from the implemented system — 61 Django models
resolving to 54 project tables plus 7 contributed tables, 13 routers registering 36
viewsets for 235 HTTP operations, 11 Celery tasks — not from a hypothetical design. Where a
requirement is not met, the requirement is marked and cross-referenced to
[DEFECTS.md](DEFECTS.md) rather than presented as satisfied.

---

## 4.2 Functional Requirements

### 4.2.1 Multi-tenancy and access control

| ID | Requirement | Implementation |
|---|---|---|
| FR-001 | The system shall isolate every institution's data, with no cross-tenant read or write under any code path. | PostgreSQL RLS on 45 tenant-scoped tables; `tenant_scope()` context manager; non-superuser app role without `BYPASSRLS`. |
| FR-002 | The system shall derive the set of protected tables automatically from the model registry so that new models are covered without manual configuration. | `post_migrate` receiver calling `derive_tenant_scoped_tables()`. |
| FR-003 | The system shall apply row-level security policies automatically on every migration. | `post_migrate` receiver in `apps/common/apps.py`. |
| FR-004 | The system shall return 404, not 403, for resources the requester is not authorised to see, so that existence is not disclosed. | Verified at runtime — see [Chapter 5 §5.3](CHAPTER_5_RESULTS_AND_DISCUSSION.md#532-tenant-isolation-verified-at-runtime). |
| FR-005 | The system shall prevent deletion of a tenant while any of its rows exist. | `TenantScopedModel.tenant` uses `on_delete=PROTECT`; suspension is by status, not deletion. |

### 4.2.2 Institutional structure

| ID | Requirement | Implementation |
|---|---|---|
| FR-010 | The system shall model the hierarchy faculty → department → programme → course → academic session → semester → course offering. | 10 tables in `apps.academics`. |
| FR-011 | The system shall scope courses to an academic session and semester. | `CourseOffering`, `Semester`, `AcademicSession`. |
| FR-012 | The system shall record student enrolment per course offering. | `CourseEnrollment`. |
| FR-013 | The system shall record lecturer assignment per course offering. | `LecturerCourseAssignment`. |
| FR-014 | The system shall record curriculum membership of courses within programmes. | `CurriculumCourse`. |

### 4.2.3 Identity and access

| ID | Requirement | Implementation |
|---|---|---|
| FR-020 | The system shall authenticate users by email and password and issue JWT access and refresh tokens. | `apps.accounts`, SimpleJWT. |
| FR-021 | The system shall support three in-tenant roles — student, lecturer, tenant administrator — plus a platform superuser. | `accounts.User.role`. |
| FR-022 | The system shall require email verification before a tenant account is activated. | `EmailVerificationCode`, Celery dispatch. |
| FR-023 | The system shall support password reset by email. | `PasswordResetToken` + Celery dispatch. |
| FR-024 | The system shall revoke outstanding tokens on password change. | `PasswordResetToken`, `BlacklistedToken`. |
| FR-025 | The system shall store passwords as salted hashes and never in plain text. | Django's password hashers. |
| FR-026 | The system shall allow a signed-in user without a tenant to request a university workspace. | `TenantRequest` + public `/request-institution` route. |
| FR-027 | The system shall suspend a tenant's logins after a grace period rather than deleting its data. | `restrict_suspended_tenant_logins` Celery task; `SUSPENSION_GRACE_HOURS`. |
| FR-028 | The system shall restrict platform-superuser operations to platform routes. | `RequireSuperuser` permission; frontend `RequireSuperuser` guard. |

### 4.2.4 Resources, ingestion and retrieval

| ID | Requirement | Implementation |
|---|---|---|
| FR-030 | The system shall accept uploads of PDF, DOCX, XLSX, PPTX, TXT and Markdown. | `apps.resources` upload service; extraction in `_extract_text()`. |
| FR-031 | The system shall store uploaded files in S3-compatible object storage and return signed, short-lived preview URLs. | MinIO; signed URL generation. |
| FR-032 | The system shall process ingestion asynchronously, tracking state through pending → processing → ready/failed. | `Resource.ProcessingStatus`; Celery `ingestion` queue. |
| FR-033 | The system shall segment documents into chunks and embed each chunk for vector search. | `_simple_chunk()`; pgvector column on `ResourceChunk`. |
| FR-034 | The system shall extract concepts and typed relations between them during ingestion. | `_persist_concepts_and_edges()`; `Concept`, `ConceptEdge`, `ResourceConcept`. |
| FR-035 | The system shall support versioning of a resource, retaining prior versions. | `ResourceVersion` with `UniqueConstraint(resource, version_number)`. |
| FR-036 | The system shall generate an AI summary of a resource asynchronously. | `summarize_resource_task` on the `ai` queue. |
| FR-037 | The system shall support six visibility scopes: private, course, programme, department, faculty, institution. | `Resource.Visibility`. |
| FR-038 | The system shall record per-user resource grants and reports. | `ResourceAccess`, `ResourcePermission`, `ResourceReport`. |
| FR-039 | The system shall moderate resources, flagging and removing them. | `Resource.ModerationStatus` (active/flagged/removed). |

### 4.2.5 Grounded question answering

| ID | Requirement | Implementation |
|---|---|---|
| FR-040 | The system shall answer a question only from passages the requester is authorised to read. | `_authorized_resource_ids()` invoked **before** ranking in `hybrid_retrieve()`. |
| FR-041 | The system shall retrieve using dense vector search, sparse lexical search and concept-graph expansion. | `hybrid_retrieve()`; three ranked lists. |
| FR-042 | The system shall fuse the three ranked lists with Reciprocal Rank Fusion at k = 60. | `_rrf_fuse(rank_lists, k=60)`. |
| FR-043 | The system shall cite the specific chunk supporting each answer. | `ChatMessageSource` linking message → chunk. |
| FR-044 | The system shall indicate answer confidence derived from the number of supporting chunks. | `compute_confidence()`: ≥3 high, 1–2 medium, 0 low. |
| FR-045 | The system shall fold explicitly attached resources into the retrieval set. | `_fold_attached_resources()`, 10 chunks per attachment. |
| FR-046 | The system shall cap context at 24 chunks. | `RAG_MAX_CONTEXT_CHUNKS = 24`; `RAG_TOP_K = 8`. |
| FR-047 | The system shall cache retrievals per tenant **and** per user with a 300-second TTL. | `RAG_CACHE_TTL_SECONDS = 300`; key = tenant + user + SHA-256(query). |
| FR-048 | The system shall stream generated tokens to the browser. | SSE endpoint sharing `iter_stream_events()`. |
| FR-049 | The system shall persist chat sessions and message history per user and optional course offering. | `ChatSession`, `ChatMessage`. |

### 4.2.6 Agents

| ID | Requirement | Implementation |
|---|---|---|
| FR-050 | The system shall provide a dedicated agent persona per in-tenant role. | `manifest.py`: Study Partner, Course Co-pilot, Institution Operator. |
| FR-051 | The system shall expose tools by function calling and execute them on the server. | `TOOL_DEFINITIONS` + `execute_tool()`; Gemini function calling. |
| FR-052 | The system shall enforce the role boundary **inside** each tool, not only by advertising a tool subset. | Each tool branches on `user.role` → `CourseEnrollment` or `LecturerCourseAssignment`. |
| FR-053 | The system shall record each tool execution. | `AgentToolExecution`. |
| FR-054 | The system shall surface the tool-call chain to the user. | Rendered in the agent interface. |
| FR-055 | The system shall persist agent sessions and per-user agent settings. | `AgentSession`, `AgentSettings`. |

### 4.2.7 Study workflow

| ID | Requirement | Implementation |
|---|---|---|
| FR-060 | The system shall let a student create study plans with dated milestones and tasks. | `Plan`, `PlanMilestone`, `PlanTask`. |
| FR-061 | The system shall allow plans to be created manually, from a template, or by the agent. | `PlanTemplate`, `create_plan` tool. |
| FR-062 | The system shall sync plan and milestone dates into the calendar. | `CalendarEvent.plan` FK. |
| FR-063 | The system shall provide month, week, day and agenda calendar views. | `VIEWS = ['month','week','day','agenda']`. |
| FR-064 | The system shall layer study plans, lectures, exams, office hours and institution events in one calendar. | `CalendarEvent.layer`, `CalendarSchedule`. |
| FR-065 | The system shall export the calendar as RFC-5545 `.ics`. | `CalendarEvent` → `.ics` endpoint. |
| FR-066 | The system shall import timetables from CSV or XLSX behind a preview step. | `CalendarUploadPage` wizard; **DEFECT D6 — the wizard cannot currently reach the preview step**. |
| FR-067 | The system shall let a student create personal notes, optionally linked to a resource. | `Note`. |
| FR-068 | The system shall let a student bookmark resources and resume reading where they stopped. | `Bookmark`, `ResourceReadingPosition`. |
| FR-069 | The system shall record learning progress per concept and record study sessions. | `ProgressRecord`, `ConceptInteraction`, `StudySession`. |
| FR-070 | The system shall exclude staff activity from cohort metrics. | `apps.academics/analytics.py` filters to students. |

### 4.2.8 Assessment

| ID | Requirement | Implementation |
|---|---|---|
| FR-080 | The system shall let a lecturer or administrator create quizzes attached to a course offering. | `Quiz.course_offering`. |
| FR-081 | The system shall let the AI generate a quiz draft from chosen documents, which the author then reviews before publishing. | `generate_quiz_task` (Celery, `ai` queue). |
| FR-082 | The system shall record the source chunk each generated question came from. | `QuizQuestion.source_chunk`. |
| FR-083 | The system shall record attempts with per-question answers. | `QuizAttempt`, `QuizQuestion`. |
| FR-084 | The system shall derive mastery from quiz results and surface concept confusion. | `ProgressRecord`; cohort signals in `analytics.py`. |

### 4.2.9 Administration and platform

| ID | Requirement | Implementation |
|---|---|---|
| FR-090 | The system shall let a tenant administrator manage users and roles. | `accounts.User` admin surface. |
| FR-091 | The system shall let a tenant administrator manage the institutional structure. | `academics` CRUD surfaces. |
| FR-092 | The system shall record an audit entry for every significant action, with actor and target. | `AuditLog` with `actor`. |
| FR-093 | The system shall log request-level diagnostics per tenant. | `TenantLog`; `/logs/`, `/logs/analyze/`. **DEFECT D3 — `?search=` returns HTTP 500.** |
| FR-094 | The system shall let a superuser provision, suspend and inspect tenants. | `apps.platform`; platform console. |
| FR-095 | The system shall show cross-tenant analytics without leaking tenant data. | Platform analytics aggregates. |
| FR-096 | The system shall report system health including dependency probes. | `/api/v1/health/` — postgres and redis latency. |
| FR-097 | The system shall allow per-tenant and platform-wide announcements by email with per-user opt-out. | `Announcement`, `AnnouncementSubscription`, `NotificationPreference`. |
| FR-098 | The system shall maintain a tenant-level dead-letter queue for failed asynchronous work. | `dlx`/`dlq` exchange in `config/celery.py`. |

### 4.2.10 Notifications

| ID | Requirement | Implementation |
|---|---|---|
| FR-100 | The system shall deliver in-app notifications to a user. | `Notification`. |
| FR-101 | The system shall let a user configure notification preferences including announcement opt-out. | `NotificationPreference`. |

### 4.2.11 Interface requirements

| ID | Requirement | Implementation |
|---|---|---|
| FR-110 | The system shall present public, student, staff, tenant-admin and platform surfaces with role-gated routes. | `guards.jsx`; 57 lazy page components. |
| FR-111 | The system shall provide a command palette for navigation. | `CommandPalette` (Ctrl+K). **DEFECT D5 — theme commands throw.** |
| FR-112 | The system shall provide a notification inbox. | `NotificationInbox`. |
| FR-113 | The system shall provide a floating role-aware agent available across screens. | `FloatingAgent`. |
| FR-114 | The system shall provide light and dark themes driven by CSS custom properties. | `oklch()` tokens in `index.css`. |
| FR-115 | The system shall be responsive from desktop to mobile. | Verified at 390×844 — [screenshot `32-mobile-dashboard.png`](screenshots/32-mobile-dashboard.png). |
| FR-116 | The system shall provide loading, empty and error states for data-driven screens. | Present throughout. |
| FR-117 | The system shall route the student dashboard links to study plans. | **DEFECT D4 — two links target the non-existent `/planner` route.** |

---

## 4.3 Non-Functional Requirements

| ID | Category | Requirement | Verification |
|---|---|---|---|
| NFR-001 | **Isolation** | A cross-tenant read shall be impossible under any application code path. | RLS on 45 tables, app role without `BYPASSRLS`; runtime 404 observed. |
| NFR-002 | **Isolation** | RLS coverage shall not require manual configuration when a model is added. | Derivation from the model registry; `migrate` prints the count. |
| NFR-003 | **Performance** | Retrieval shall be cached for repeated queries by the same user. | 300-second TTL; observed retrieval timing recorded per message. |
| NFR-004 | **Performance** | The frontend shall not ship the whole application to a user who needs one screen. | 57 lazy route chunks; production build succeeds in 18.88 s. |
| NFR-005 | **Performance** | The largest production chunks should be reviewed for budget compliance. | `AppShell` 521 kB, `pptx-preview` 1.23 MB — advisory raised; see [Chapter 5 §5.8](CHAPTER_5_RESULTS_AND_DISCUSSION.md#58-performance-observations). |
| NFR-006 | **Scalability** | Asynchronous work shall not block HTTP requests. | Celery over RabbitMQ; 5 queues with a dead-letter queue. |
| NFR-007 | **Reliability** | Failed asynchronous work shall be retained for inspection, not silently dropped. | `dlx`/`dlq` queues; `acks_late` with `task_reject_on_worker_lost`. |
| NFR-008 | **Reliability** | Document processing shall be atomic — never ready with partial embeddings. | Single transaction covering chunks, embeddings and concepts. |
| NFR-009 | **Security** | Passwords shall be stored salted and hashed. | Django password hashers. |
| NFR-010 | **Security** | Tokens shall be revocable. | Blacklist app; rotation on password change. |
| NFR-011 | **Security** | The application database role shall not be able to bypass row-level security. | Non-superuser role without `BYPASSRLS`; separate bootstrap superuser. |
| NFR-012 | **Security** | Development-only privilege escalation shall be opt-in and never ship. | `academiai_test` BYPASSRLS role gated behind `ACADEMIAI_DEV_TEST_ROLE=1`. |
| NFR-013 | **Security** | The system shall not disclose the existence of an unauthorised resource. | 404 rather than 403. |
| NFR-014 | **Security** | The retrieval cache shall not serve one user's private chunks to another. | Cache key includes tenant **and** user. |
| NFR-015 | **Security** | The model shall receive retrieved text as content, not as instructions. | Authorisation precedes retrieval; retrieved text is not concatenated into the instruction position. |
| NFR-016 | **Traceability** | Every answer claim shall be traceable to its source. | `ChatMessageSource`; citations rendered per source. |
| NFR-017 | **Traceability** | Every significant action shall be auditable with actor and target. | `AuditLog`. |
| NFR-018 | **Maintainability** | Schema changes shall be versioned and reversible. | 77 migrations, all applied. |
| NFR-019 | **Maintainability** | Architectural decisions shall be recorded with rationale. | 27 entries in `docs/DECISIONS.md`. |
| NFR-020 | **Testability** | The backend domain shall be covered by automated tests. | 280 tests; at the audited revision **277 pass, 3 fail** ([DEFECT D15](DEFECTS.md#d15--three-failing-backend-tests-medium)), **since fixed** — the full suite is green. |
| NFR-021 | **Testability** | The frontend shall pass static analysis. | `oxlint` exits 0 with no findings. |
| NFR-022 | **Testability** | The frontend shall ship a successful production build. | `vite build` succeeds; PWA service worker generated. |
| NFR-023 | **Portability** | The environment shall be reproducible from version-controlled configuration. | Docker Compose, six services. |
| NFR-024 | **Portability** | The worker shall run on the development platform. | Celery auto-selects the `solo` pool on win32. |
| NFR-025 | **Usability** | The system shall be operable by users on mobile devices. | Verified at 390×844. |
| NFR-026 | **Usability** | Both light and dark themes shall be first-class. | Both captured — screenshots `01`, `09`, `31`, `31b`. |
| NFR-027 | **Correctness** | Every admin app shall have test coverage. | **DEFECT D11 — `platform` has no tests and `audit` is an empty stub.** |
| NFR-028 | **Correctness** | API documentation shall be generable from code. | **DEFECT D2 — `/api/schema/` returns HTTP 500.** |

---

## 4.4 User Requirements

### 4.4.1 Actors

```
                    ┌──────────────────────────────────┐
                    │      Anonymous visitor          │
                    │  Landing, login, signup,         │
                    │  password reset, request         │
                    │  institution                     │
                    └────────────────┬─────────────────┘
                                     │ authenticates
                    ┌────────────────▼─────────────────┐
                    │        Authenticated user        │
                    │   (may hold no tenant membership) │
                    └──────┬──────────┬──────────┬──────┘
                           │          │          │
        ┌──────────────────▼──┐  ┌────▼─────┐  ┌─▼────────────────┐
        │       Student       │  │ Lecturer │  │ Tenant admin     │
        │  Study Partner      │  │ Co-pilot  │  │ Inst. Operator   │
        └─────────────────────┘  └──────────┘  └──────────────────┘
                           │          │          │
                           └──────────┴──────────┴──► AcademiAI (tenant-scoped)
                                                        │
                                              ┌─────────▼──────────┐
                                              │  Platform          │
                                              │  superuser         │
                                              │  cross-tenant      │
                                              └────────────────────┘
```

| Actor | Role key | Primary needs | Principal surfaces |
|---|---|---|---|
| Anonymous visitor | — | Understand the product; register; request an institutional workspace | Landing, `/login`, `/signup`, `/verify-email`, `/password-reset`, `/request-institution` |
| Student | `student` | Answer questions from course material; plan and schedule study; self-assess; track progress; keep notes and bookmarks | Dashboard, chat, resources, upload, quizzes, notes, bookmarks, progress, plans, calendar, settings |
| Lecturer | `lecturer` | Manage resources for assigned offerings; draft quizzes; analyse cohort performance; read concept-confusion signals | Lecturer dashboard, assigned courses, quiz manager, course analytics |
| Tenant administrator | `tenant_admin` | Manage structure, users, access rules, templates, timetables; govern announcements; inspect audit and health | Admin dashboard, tenant structure, users, courses, audit log, request logs, plan templates, timetable upload |
| Platform superuser | `superuser` | Provision and suspend tenants; review institution requests; view cross-tenant analytics, health and platform audit | Platform console, tenants, requests, analytics, health, audit, announcements |

### 4.4.2 Stakeholder requirements

| Stakeholder | Requirement |
|---|---|
| Student | Answers must come from my course material; I must be able to check them; answers must lead to scheduled work. |
| Lecturer | Quiz drafting must use my documents, not invention; analytics must describe students, not staff. |
| Tenant administrator | I must configure the institution without developer help; I must be able to see who did what. |
| Institution | My data must not be readable by any other institution, including through a defect. |
| Platform operator | Tenant provisioning must be self-service; platform health must be observable. |

---

## 4.5 System Requirements

### 4.5.1 Hardware

| Component | Specification |
|---|---|
| Server | 4 vCPU, 8 GB RAM, 20 GB SSD for the full Compose stack |
| GPU | Not required — inference is delegated to the Gemini API |

### 4.5.2 Software

| Layer | Requirement |
|---|---|
| Operating system | Cross-platform; verified on Windows 11. Linux is expected for production. |
| Language runtime | Python 3.13, Node 20 |
| Web server | Any WSGI server (Django `runserver` for development) |
| Database | PostgreSQL 16 with the pgvector extension |
| Broker | RabbitMQ 3 (management image) |
| Cache | Redis 7 |
| Object storage | Any S3-compatible service — MinIO in development, AWS S3 in production |
| Email | SMTP — Mailpit in development |

### 4.5.3 External interfaces

| Interface | Protocol | Purpose |
|---|---|---|
| Gemini API | HTTPS | Answer generation and embeddings |
| MinIO / S3 | S3 API | Document upload, retrieval, signed previews |
| RabbitMQ | AMQP | Celery broker |
| Redis | RESP | Cache and result backend |
| SMTP | SMTP | Verification, password reset, announcements |
| Browser → backend | HTTPS + JSON | REST API, JWT Bearer |
| Browser ← backend | HTTPS, `text/event-stream` | Token streaming and ingestion progress |

---

## 4.6 UML Diagrams

### 4.6.1 Use-case diagram

```
                        ┌────────────────────────────────────────────┐
                        │              AcademiAI                       │
                        │                                              │
  ┌───────────┐         │   ┌──────────────────────────┐               │
  │ Anonymous │─────────┼──▶│ Browse landing page       │               │
  │ visitor   │         │   │ Request institution access│               │
  └───────────┘         │   │ Reset password / verify   │               │
                        │   └──────────────────────────┘               │
                        │                                              │
  ┌───────────┐         │   ┌──────────────────────────┐               │
  │  Student  │─────────┼──▶│ Ask grounded question     │               │
  │           │         │   │ Open cited source         │               │
  │           │         │   │ Upload resource           │               │
  │           │         │   │ Preview resource          │               │
  │           │         │   │ Create study plan         │               │
  │           │         │   │ Add milestone / task      │               │
  │           │         │   │ View calendar (4 views)   │               │
  │           │         │   │ Create event              │               │
  │           │         │   │ Take quiz                 │               │
  │           │         │   │ Write note / bookmark     │               │
  │           │         │   │ Track progress            │               │
  │           │         │   │ Manage settings           │               │
  │           │         │   └──────────────────────────┘               │
  │           │         │                                              │
  │           │         │   ┌──────────────────────────┐               │
  │           │─────────┼──▶│ Study Partner agent       │               │
  │           │         │   └──────────────────────────┘               │
  └───────────┘         │                                              │
                        │   «include»                                  │
                        │   Authorisation filter ─ ─ ─ ▶ every          │
                        │                              retrieval use case│
  ┌───────────┐         │                                              │
  │ Lecturer  │─────────┼──▶│ Manage assigned resources │               │
  │           │         │   │ Draft quiz with AI        │               │
  │           │         │   │ Review / publish quiz     │               │
  │           │         │   │ View course analytics     │               │
  │           │         │   │ View concept confusion    │               │
  │           │         │   └──────────────────────────┘               │
  │           │         │   ┌──────────────────────────┐               │
  │           │─────────┼──▶│ Course Co-pilot agent     │               │
  └───────────┘         │   └──────────────────────────┘               │
                        │                                              │
  ┌───────────┐         │   ┌──────────────────────────┐               │
  │  Tenant   │─────────┼──▶│ Manage faculty/dept/      │               │
  │   admin   │         │   │   programme/course        │               │
  │           │         │   │ Manage users & roles      │               │
  │           │         │   │ Manage plan templates     │               │
  │           │         │   │ Import timetable          │               │
  │           │         │   │ Publish announcement      │               │
  │           │         │   │ View audit log            │               │
  │           │         │   │ View request logs         │               │
  │           │         │   │ View tenant health        │               │
  │           │         │   └──────────────────────────┘               │
  │           │         │   ┌──────────────────────────┐               │
  │           │─────────┼──▶│ Institution Operator agent│               │
  └───────────┘         │   └──────────────────────────┘               │
                        │                                              │
  ┌───────────┐         │   ┌──────────────────────────┐               │
  │  Platform │─────────┼──▶│ Provision / suspend tenant│               │
  │ superuser │         │   │ Review institution request│               │
  │           │         │   │ Cross-tenant analytics    │               │
  │           │         │   │ System health             │               │
  │           │         │   │ Platform audit log        │               │
  └───────────┘         │   └──────────────────────────┘               │
                        └────────────────────────────────────────────┘
```

### 4.6.2 Class diagram — core domain

```
┌──────────────────────┐            ┌──────────────────────┐
│       Tenant         │            │      User            │
│  (UUIDModel)         │◄───PROTECT─│  (UUIDModel)         │
│  name, slug (unique) │            │  email (unique)      │
│  status, plan        │            │  role, is_active     │
└──────┬───────────────┘            │  is_email_verified   │
       │                            └───┬──────────┬───────┘
       │ 1:N                            │1:1       │1:1
       ▼                                ▼          ▼
┌──────────────┐              ┌──────────────┐ ┌──────────────┐
│  StudentProfile│            │LecturerProfile│ │EmailVerif.. │
│  programme→   │            │ department→  │ │PasswordR..  │
└──────────────┘              └──────────────┘ └──────────────┘

┌───────────────────────── Academic hierarchy ─────────────────────────┐
│                                                                      │
│  Faculty ──1:N──▶ Department ──1:N──▶ Programme ──1:N──▶ CurriculumCourse
│                                │                                     │
│                                └──1:N──▶ Course ◀───────────────────┘
│                                                                      │
│  AcademicSession ──1:N──▶ Semester                                   │
│  Course + Semester + Session ──1:N──▶ CourseOffering                 │
│  CourseOffering ──1:N──▶ CourseEnrollment (student)                  │
│  CourseOffering ──1:N──▶ LecturerCourseAssignment (lecturer)         │
└──────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────── Resources & knowledge ───────────────────────┐
│  Resource ──1:N──▶ ResourceVersion ──1:N──▶ ResourceChunk (embedding)│
│      │                      │                       ▲               │
│      │ visibility: private|course|programme|department|faculty|institution
│      ├──▶ ResourceSummary        │                       │               │
│      ├──▶ ResourceAccess         │                       │               │
│      ├──▶ ResourcePermission     │                       │               │
│      ├──▶ ResourceReport         │                       │               │
│      └───────────────────────────┘                       │               │
│                                                              │               │
│  Concept ──▶ ConceptEdge (source_concept ⇄ target_concept) │               │
│  ResourceConcept ──▶ (resource, concept, source_chunk) ──────┘               │
└──────────────────────────────────────────────────────────────────────┘

┌────────────────────────── Conversation ──────────────────────────────┐
│  ChatSession ──1:N──▶ ChatMessage ──1:N──▶ ChatMessageSource         │
│      │  user, course_offering          ▲         │                    │
│      │                                 └─────────┘                    │
│      │                                    (chunk CASCADE)            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── Study loop ──────────────────────────────┐
│  Plan ──1:N──▶ PlanMilestone ──1:N──▶ PlanTask ──▶ Resource (nullable) │
│    │ user                        │                 resource          │
│    └──▶ CalendarEvent.plan (SET_NULL)                                 │
│  Note(user, resource?)   Bookmark(user, resource)                     │
│  ResourceReadingPosition(user, resource, resource_version)            │
│  ProgressRecord(user, concept)   ConceptInteraction(user, concept)   │
│  StudySession(user, course_offering)                                  │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────── Assessment ───────────────────────────────┐
│  Quiz ──1:N──▶ QuizQuestion ──▶ source_chunk (SET_NULL)              │
│    │ course_offering, created_by         ▲                           │
│    └──1:N──▶ QuizAttempt ──▶ student     │ provenance of AI questions│
└──────────────────────────────────────────────────────────────────────┘

┌───────────────────────────── Agent ──────────────────────────────────┐
│  AgentSession(user) ──1:N──▶ AgentToolExecution                     │
│  AgentSettings(user)                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Reading the diagram.** Four design decisions are visible and load-bearing:

1. **`ResourceChunk` hangs off `ResourceVersion`, not `Resource`.** Re-uploading a document
   creates a new version rather than mutating the resource, so prior citations remain
   resolvable.
2. **`ChatMessageSource` references `ResourceChunk` directly.** The citation is to the
   exact segment, not merely to the document — which is what makes a claim checkable.
3. **`QuizQuestion.source_chunk` is nullable.** An AI-generated question records the chunk
   it came from, so a lecturer can audit the provenance of a draft.
4. **`PlanTask.milestone` is non-nullable.** Every task belongs to a milestone. This
   constraint is correct and is the cause of [DEFECT D1](DEFECTS.md#d1--plan-tasks-cannot-be-created-through-the-api-high):
   the serializer forgot to expose it.

### 4.6.3 Sequence diagram — a grounded chat turn

```
Student    Browser      DRF View      retrieve()     hybrid_retrieve()   pgvector/RRF   Gemini
   │          │             │             │                │                  │            │
   │ POST     │             │             │                │                  │            │
   │ /chat/   │────────────▶│             │                │                  │            │
   │ send/    │             │             │                │                  │            │
   │          │──JWT───────▶│             │                │                  │            │
   │          │             │ tenant_scope(user.tenant_id)  │                 │            │
   │          │             │───────▶│    │                │                  │            │
   │          │             │         │    │ ① AUTHORISED RESOURCE IDS      │            │
   │          │             │         │    │──▶ _authorized_resource_ids()  │            │
   │          │             │         │    │        │ RLS filters │          │            │
   │          │             │         │    │        │◀── ids ──────┘          │            │
   │          │             │         │    │                                  │            │
   │          │             │         │    │ ② cache key = tenant+user+     │            │
   │          │             │         │    │    sha256(query);  TTL 300s      │            │
   │          │             │         │    │  ┌─── hit ──────────────────────┼──▶ return  │
   │          │             │         │    │  │                               │   cached   │
   │          │             │         │    │  └── miss ──┐                    │            │
   │          │             │         │    │            ▼                    │            │
   │          │             │         │    │    ③a DENSE  cosine top-K ───────▶│            │
   │          │             │         │    │            ◀── ranked ids ──────┤            │
   │          │             │         │    │    ③b LEXICAL ts_rank  ───────▶│            │
   │          │             │         │    │            ◀── ranked ids ──────┤            │
   │          │             │         │    │    ③c CONCEPT 1-hop expand ────▶│            │
   │          │             │         │    │            ◀── ranked ids ──────┤            │
   │          │             │         │    │                                  │            │
   │          │             │         │    │    ④ RRF  Σ 1/(60+rank) ────────▶│            │
   │          │             │         │    │            ◀── fused order ─────┤            │
   │          │             │         │    │                                  │            │
   │          │             │         │    │ ⑤ fold attached (10 each)      │            │
   │          │             │         │    │ ⑥ confidence: n≥3 high | 1-2 med| 0 low      │
   │          │             │         │    │───────▶ (chunks, ms, conf)      │            │
   │          │             │◀────────────┤                                │            │
   │          │             │                                                      │            │
   │          │             │ ⑦ GENERATE from ≤24 chunks, instruction = "answer  │            │
   │          │             │    ONLY from these; say so if unsupported" ──────────▶│            │
   │          │             │◀── tokens ───────────────────────────────────────────┤            │
   │          │◀══ SSE ═════┤                                                      │            │
   │          │             │ persist ChatMessage + ChatMessageSource(chunk)      │            │
   │          │             │                                                      │            │
```

Two properties are worth naming. At **step ①** the authorised set is computed before
any ranking, so unauthorised text cannot influence the ranking, the context or the answer.
At **step ④** RRF consumes only ranks, which is why three retrievers with incomparable score
scales can be fused without calibration.

### 4.6.4 Sequence diagram — document ingestion

```
Lecturer   Browser    View     MinIO/S3    DB      Celery(ingestion)   Gemini
   │          │         │         │          │           │              │
   │ request  │         │         │          │           │              │
   │ presigned│────────▶│────────▶│          │           │              │
   │   PUT    │◀────────┤◀────────┤          │           │              │
   │ upload   │────────▶│          │          │           │              │
   │ bytes    │         │         │          │           │              │
   │          │         │ Resource(pending) ─▶│         │              │
   │          │         │         │          │ enqueue ─▶│              │
   │◀─ 202 Accepted + SSE "processing" ────┤           │              │
   │          │         │          │          │  ① _extract_text()       │              │
   │          │         │          │          │◀── object bytes ─────────┼───────────▶│
   │          │         │          │          │──── text ────────────────┼───────────▶│
   │          │         │          │          │  ② _simple_chunk()       │              │
   │          │         │          │◀── ResourceChunk rows (PENDING) ─┤              │
   │          │         │          │      ③ embed each chunk ──────────────────────▶│
   │          │         │          │◀── vectors ────────────────────┼──────────────┤
   │          │         │          │      ④ extract concepts/edges ─────────────────▶│
   │          │         │          │◀── Concept, ConceptEdge, ResourceConcept ─────┤
   │          │         │          │  ⑤ processing_status = READY ──┤              │
   │◀═══ SSE "ready" ══════════════┤                              │              │
   │          │         │          │           enqueue "ai" ──────▶│ summarize    │
   │◀═══ SSE "summary ready" ══════════════════════════════════════┤              │
```

The transaction boundary matters: a resource becomes `READY` only after its chunks,
embeddings and concepts are all committed, so retrieval can never surface a
half-ingested document ([NFR-008](#43-non-functional-requirements)).

### 4.6.5 Sequence diagram — isolated login

```
User        AuthView      tenant_scope()      PostgreSQL          Celery
 │              │               │                 │                 │
 │ POST login   │               │                 │                 │
 │─────────────▶│  authenticate_user(); verify password hash       │
 │              │──SELECT user WHERE email=? ────▶│                 │
 │              │◀── user row (RLS not yet bound) ┤                 │
 │              │  user.is_active && tenant.status == ACTIVE?       │
 │              │  ── if tenant suspended: reject ─────────────────  │
 │              │  issue access + refresh JWT; blacklist rotation   │
 │              │───── SET app.current_tenant = tenant_id ────────▶│
 │              │  load profile, roles, agent key                  │
 │◀─ 200 tokens ─┤                                               │
 │              │                                                  │
 │  ── LATER, ordinary request ─────────────────────────────────  │
 │              │  Bearer token → resolve user → tenant from membership
 │              │  RESET app.current_tenant at end of request       │
 │              │  ── any unscoped query now returns ZERO rows ──▶│
```

The final step is the enforcement point: the tenant context is bound for the request and
reset afterwards, so a query issued outside a bound scope returns no rows rather than all
rows. This is why the forgetting-a-filter defect produces an empty result instead of a
cross-tenant leak.

---

## 4.7 Database Design

### 4.7.1 Conceptual design (ER)

The conceptual model has four clusters. Cross-cluster relationships are shown because they
carry the authorisation semantics.

```
┌───────────────────────── CLUSTER A: Identity & tenancy ─────────────────────────┐
│                                                                               │
│   ┌───────────┐         ┌──────────────────────────┐                          │
│   │  TENANT   │◄────────│           USER            │                          │
│   │ name      │ 1:N PROTECT  role                   │                          │
│   │ slug UQ  │         │  email UQ   is_active     │                          │
│   │ status    │         └──────┬─────────────┬───────┘                          │
│   └─────┬─────┘                │ 1:1         │ 1:1                              │
│         │ 0..N                ▼              ▼                                │
│         │              ┌─────────────┐ ┌──────────────┐                       │
│         │              │StudentProfile│ │LecturerProfile│                     │
│         │              │  programme▲ │ │  department▲ │                     │
│         │              └─────────────┘ └──────────────┘                       │
│                                                                               │
│   ┌──────────────────┐      ┌──────────────────┐                               │
│   │  TenantRequest   │─────▶│    TENANT        │  (approved request provisions  │
│   │  status, reviewer│      └──────────────────┘   a tenant)                  │
│   └──────────────────┘                                                            │
└───────────────────────────────────────────────────────────────────────────────┘

┌──────────────────── CLUSTER B: Academic structure ────────────────────────────┐
│                                                                               │
│  ┌─────────┐   ┌────────────┐   ┌─────────────┐   ┌────────────────┐          │
│  │ FACULTY │──▶│ DEPARTMENT │──▶│  PROGRAMME  │──▶│CurriculumCourse│          │
│  └────┬────┘   └─────┬──────┘   └─────────────┘   └───────┬────────┘          │
│       │              │                                     │                   │
│       │              │                          ┌──────────▼─────────┐         │
│       │              │                          │      COURSE        │         │
│       │              │                          │  code UQ (faculty) │         │
│       │              │                          └──────────┬─────────┘         │
│       │              │                                     │                   │
│       │  ┌───────────┴───────────┐         ┌───────────────▼──────────┐        │
│       └──▶   AcademicSession    │         │     COURSE OFFERING      │        │
│           │  ──1:N──▶ Semester ──┼────────▶│  (course+session+semester)│        │
│           └──────────────────────┘         └───┬────────────────┬───┘        │
│                                                  │ 1:N            │ 1:N        │
│                                    CourseEnrollment      LecturerCourseAssignment
│                                          │ student           │ lecturer     │
└───────────────────────────────────────────────────────────────────────────────┘

┌─────────────── CLUSTER C: Resources & concept knowledge ──────────────────────┐
│                                                                               │
│   ┌──────────────────────┐  1:N   ┌──────────────────┐  1:N ┌───────────────┐ │
│   │      RESOURCE        │───────▶│ RESOURCE VERSION │─────▶│ RESOURCE CHUNK│ │
│   │ title, mime_type     │        │ version_number   │      │ text          │ │
│   │ visibility (6 levels)│        │ storage_key      │      │ embedding     │ │
│   │ processing_status    │        │ checksum         │      │ (pgvector)    │ │
│   │ moderation_status    │        │ file_size_bytes  │      └───────┬───────┘ │
│   │  ┌─▶ course_offering │        │ UQ(resource,ver) │              │         │
│   │  ├─▶ programme       │        └──────────────────┘              │         │
│   │  ├─▶ department      │                                          │         │
│   │  ├─▶ faculty         │  ┌────────────┐   N:M   ┌────────────────▼───────┐ │
│   │  └─▶ uploaded_by     │  │  CONCEPT   │◀────────│    ResourceConcept      │ │
│   └──────┬───────────────┘  └─────┬──────┘         └────────────────────────┘ │
│          │ 1:N                     │ self-referential                          │
│   ┌──────▼────────┐        ┌───────▼──────────┐                               │
│   │ResourceSummary│        │   CONCEPT EDGE    │                               │
│   │ResourceAccess │        │ source_concept    │                               │
│   │ResourcePermis.│        │ target_concept    │                               │
│   │ResourceReport │        │ relation_type     │                               │
│   └───────────────┘        └──────────────────┘                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────── CLUSTER D: Conversation & study ─────────────────────────┐
│                                                                               │
│  ┌────────────┐  1:N  ┌───────────────┐  1:N  ┌───────────────────┐           │
│  │ChatSession │──────▶│  ChatMessage  │──────▶│ ChatMessageSource │           │
│  │ user       │       │ content       │       │  ──▶ RESOURCE    │           │
│  │ offering?  │       │ confidence    │       │      CHUNK        │           │
│  └────────────┘       └───────────────┘       └───────────────────┘           │
│                                ▲ citation target = the exact chunk            │
│                                                                               │
│  ┌──────┐ 1:N ┌───────────────┐ 1:N ┌──────────────┐                         │
│  │ PLAN │────▶│ PLAN MILESTONE│────▶│  PLAN TASK   │──▶ RESOURCE?           │
│  │ user │     │  due_date     │     │ due_date     │                         │
│  └──────┘     └──────────────┘     └──────────────┘                         │
│      │                                                                   │
│      └────────▶ ┌──────────────┐  N:1  ┌──────────────┐                     │
│                 │CalendarEvent │◀──────│  CourseOffering│                    │
│                 │ layer, type  │        └──────────────┘                     │
│                 └──────┬───────┘                                             │
│                        │ 1:N                                                 │
│                 ┌──────▼───────┐                                             │
│                 │CalendarSchedule│ (timetable import)                       │
│                 └──────────────┘                                             │
│                                                                               │
│  NOTE(user, resource?)   BOOKMARK(user, resource)                           │
│  PROGRESS RECORD(user, concept)   CONCEPT INTERACTION(user, concept)         │
│  STUDY SESSION(user, offering)   READING POSITION(user, resource, version)   │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Conceptual relationships.** The cardinality that matters most is
`ResourceChunk ← ChatMessageSource`: one chunk may support many messages, and each message
carries many sources — a many-to-many resolved by an explicit associative entity. Because
the association names the exact chunk, it is also the mechanism by which a user verifies a
citation.

The second that matters is `Resource → course_offering / programme / department /
faculty`. A resource carries up to four nullable structural references plus a
`visibility` discriminator. This is the single most consequential modelling decision in the
system: it is what makes authorisation a property of *data* rather than of application
code paths.

### 4.7.2 Physical design

**Table counts.** 61 Django models resolve to **54 project tables** plus **7 contributed
tables** (`auth.Permission`, `auth.Group`, `contenttypes.ContentType`, `admin.LogEntry`,
`sessions.Session`, `token_blacklist.BlacklistedToken`, `token_blacklist.OutstandingToken`).

| App | Tables | Key relationships |
|---|---|---|
| `tenants` | 2 | `TenantRequest.provisioned_tenant → Tenant` |
| `accounts` | 5 | `User.tenant → Tenant` (CASCADE); `StudentProfile.programme → Programme` (SET_NULL); `LecturerProfile.department → Department` (SET_NULL) |
| `academics` | 10 | `Semester.academic_session → AcademicSession` (CASCADE, **PROTECT** to tenant); `CourseEnrollment` and `LecturerCourseAssignment` → `CourseOffering` |
| `resources` | 7 | `ResourceVersion.resource → Resource` (CASCADE, UQ on `(resource, version_number)`); `ResourceChunk.resource_version → ResourceVersion` (CASCADE); `ResourcePermission` → `Resource`, `User`, `CourseOffering` |
| `knowledge` | 3 | `ConceptEdge.source_concept`/`target_concept → Concept` (CASCADE); `ResourceConcept` → `Resource`, `Concept`, `ResourceChunk` |
| `chat` | 3 | `ChatSession.user → User` (CASCADE); `ChatMessage.session → ChatSession` (CASCADE); `ChatMessageSource` → `ChatMessage` and `ResourceChunk` (both CASCADE) |
| `learning` | 10 | `PlanMilestone.plan → Plan` (CASCADE); `PlanTask.milestone → PlanMilestone` (CASCADE, **NOT NULL**); `CalendarEvent.plan → Plan` (SET_NULL) |
| `assessments` | 3 | `QuizQuestion.quiz → Quiz` (CASCADE), `source_chunk → ResourceChunk` (SET_NULL); `QuizAttempt` → `Quiz`, `User` |
| `calendar` | 2 | `CalendarEvent` → `Tenant`, `User`, `CourseOffering`, `Plan`, and self (`office_hours`) |
| `agent` | 3 | `AgentToolExecution.session → AgentSession` (CASCADE) |
| `audit` | 1 | `AuditLog.actor → User` (SET_NULL) — the actor survives user deletion |
| `notifications` | 2 | `Notification`, `NotificationPreference` → `User` (CASCADE) |
| `platform` | 2 | `Announcement.created_by` (SET_NULL); `AnnouncementSubscription.user` (CASCADE) |
| `logs` | 1 | `TenantLog` — no FKs; request-level diagnostics |

**Physical rules applied across the schema.**

| Rule | Implementation | Rationale |
|---|---|---|
| UUID primary keys | `UUIDModel.id = UUIDField(default=uuid4)` on every project model | Guessing a sequential integer must not be an enumeration vector. |
| Timestamps | `TimeStampedModel.created_at` / `updated_at` | `created_at` is deliberately **not** globally indexed; only models that order by it opt in. |
| Tenant foreign key | `TenantScopedModel.tenant → Tenant, on_delete=PROTECT` | A tenant cannot be deleted while any row references it. Suspension is by status, so no accidental cascade can destroy an institution's data. |
| Ownership deletion | `on_delete=CASCADE` for data a user owns exclusively (`Note`, `Bookmark`, `ChatSession`) | Deleting a student should remove their personal study artefacts. |
| Referential history | `on_delete=SET_NULL` for attribution (`AuditLog.actor`, `Quiz.created_by`, `Resource.uploaded_by`) | The record of what happened must survive the deletion of the person who did it. |
| Structural references | `on_delete=SET_NULL` for `Resource` → offering/programme/department/faculty | Restructuring a department must not delete its documents. |
| Answer provenance | `ChatMessageSource.chunk` CASCADE; `QuizQuestion.source_chunk` SET_NULL | A citation dies with its message; a question's provenance survives its source being re-uploaded. |
| Versioning | `ResourceVersion` UQ `(resource, version_number)`, `ordering = ["-version_number"]` | Latest version is unambiguous; history is retained. |
| Integrity in the app layer | `PlanTask.milestone` NOT NULL | Every task belongs to a milestone — see [D1](DEFECTS.md#d1--plan-tasks-cannot-be-created-through-the-api-high). |

**Row-level security.** Every table inheriting `TenantScopedModel` receives a policy on
every `migrate`, keyed on the tenant bound to the session, with `FORCE ROW LEVEL
SECURITY` so the policy binds even the table owner. 45 tables are derived automatically.
The application role is a non-superuser without `BYPASSRLS`; a separate superuser exists
only to bootstrap the schema.

```sql
-- Emitted by apps/common/rls.py, derived from the model registry rather than
-- hand-written per table. Reproduced here in its actual generated form.
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON <table> FOR ALL
USING      (tenant_id::text = current_setting('app.current_tenant_id', true))
WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
```

`tenant_scope(tenant_id)` binds the session variable with
`SELECT set_config('app.current_tenant_id', %s, true)` — the third argument is `true`, so
the binding is **transaction-local** and cannot outlive the request even if the reset were
skipped. The comparison is text-based rather than a UUID cast, so an unbound setting
(`current_setting(..., true)` returning `NULL`) yields `NULL` and therefore no rows,
rather than raising a cast error.

`WITH CHECK` matters as much as `USING`: without it, a tenant could write a row into
another tenant.

### 4.7.3 Indexing strategy

Verified against `pg_indexes` in the live database.

| Purpose | Approach | Present? |
|---|---|---|
| Referential integrity and join lookup | `btree` on every FK, plus `_pkey` and unique constraints | **Yes** — 319 indexes |
| Tenant scoping | `tenant_id` is the leading component of composite indexes on hot tables | **Yes** |
| Resource lookup by structure | Indexes on `Resource.course_offering`, `.visibility_scope`, `.moderation_status`, `.processing_status` | **Yes** |
| Version resolution | `UNIQUE (resource_version_id, chunk_index)` | **Yes** |
| Chunk ordering within a version | `UNIQUE (resource_version_id, chunk_index)` | **Yes** |
| Ordering by `created_at` | Declared per model — **13 of the 43** tenant-scoped models that have the column | **Partial** |
| Vector similarity (ANN) | `hnsw` on `embedding` with `vector_cosine_ops`, partial on `embedding IS NOT NULL` | **Yes** — added as [D16](DEFECTS.md#d16--retrieval-runs-sequentially-with-no-vector-or-full-text-index-medium) |
| Lexical full-text | Persisted generated `tsvector` column with a `GIN` index | **Yes** — added as D16 |

**`created_at` indexing is deliberately selective.** Of the 45 tenant-scoped tables, 43
carry a `created_at` column, and 13 index it — `AuditLog`, `Bookmark`, `CalendarSchedule`,
`ChatMessage`, `ChatSession`, `Notification`, `PlanTask`, `Quiz`, `QuizAttempt`, `Resource`,
`ResourceReport`, `ResourceSummary` and `User`. The other 30 do not. The discipline holds
in the cases that matter: `CalendarEvent` orders on `start` rather than `created_at` and
indexes `start`; `ResourceChunk` is read by `(resource_version, chunk_index)` and is
uniquely indexed on exactly that pair. Blanket-indexing every `created_at` would have cost
write throughput and disk for 30 tables that never sort on it.

**The two retrieval indexes were missing, and are now in place.** When this section was
first verified the `vector` extension was installed and `resource_chunks.embedding` was a
real `pgvector` column, but no `hnsw` or `ivfflat` index existed on it, and there was no
`tsvector` column or `GIN` index anywhere in the schema — the design had been written as
though an index existed without carrying it through to a migration. That gap is recorded
as [D16](DEFECTS.md#d16--retrieval-runs-sequentially-with-no-vector-or-full-text-index-medium)
and was closed during this pass by two migrations and one query rewrite:

- `resource_chunks_embedding_hnsw` — `hnsw (embedding vector_cosine_ops)`, partial on
  `embedding IS NOT NULL`, created by raw SQL because Django cannot express `hnsw`
  through `Meta.indexes`.
- A persisted generated `tsvector` column (`to_tsvector('english'::regconfig, content)`)
  with `resource_chunks_ts_vector_gin`, and lexical retrieval at
  `backend/apps/knowledge/retrieval.py` changed to rank the stored column and filter on
  `@@`, giving the planner an index-usable predicate.

With the row-level security policy lifted, `EXPLAIN` selects `Index Scan using
resource_chunks_embedding_hnsw` for the distance ordering and `Bitmap Index Scan on
resource_chunks_ts_vector_gin` for the lexical leg. With the policy active the planner
still chooses a sequential scan over the current 706-chunk corpus, because the policy
predicate is emitted as `(tenant_id)::text = current_setting(…)` and evaluated as a filter
rather than an index condition. That affects the plan chosen at this size, not
correctness; the measurement is set out in
[EVIDENCE §3.1](EVIDENCE.md#31-index-inventory).

---

## 4.8 Design Decisions Bearing on Requirements

| Decision | Requirement affected | Consequence |
|---|---|---|
| Compute authorised resource IDs before ranking | FR-040, NFR-001, NFR-015 | Unauthorised text cannot reach the ranker or the model |
| Cache key includes tenant **and** user | NFR-014 | Prevents private-resource leakage between students |
| `tenant` FK is `PROTECT` | FR-005 | Tenant deletion is impossible while data exists |
| RLS derived from the model registry | FR-002, NFR-002 | New models are protected without a manual step |
| Citations reference the chunk, not the document | FR-043, NFR-016 | Claims are checkable at segment granularity |
| Non-nullable `PlanTask.milestone` | FR-060 | Correct integrity rule; serializer omission causes [D1](DEFECTS.md#d1--plan-tasks-cannot-be-created-through-the-api-high) |
| Role enforced inside agent tools | FR-052 | A hallucinated tool call cannot escape the caller's role |
| UTC timestamps, tenant timezones at presentation | general | Avoids daylight-saving ambiguity in exam and lecture times |

---

**Next:** [Chapter Five — Results and Discussion](CHAPTER_5_RESULTS_AND_DISCUSSION.md)

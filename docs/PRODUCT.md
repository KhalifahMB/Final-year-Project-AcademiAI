# Product

<!-- impeccable:product-schema 1 -->

<!-- Canonical path: docs/PRODUCT.md. This file was moved here from the repository root in
commit 1d1c731; `impeccable context` only auto-resolves a root-level PRODUCT.md, so pass this
path explicitly rather than assuming the record is missing. -->

## Platform

web

## Users

- **Students:** Primary daily users. Ask grounded course questions, manage notes and bookmarks, take quizzes, and track learning progress. Also plan study (goals → dated milestones and tasks), work in the layered calendar, resume reading where they stopped, and attach files directly into a conversation.
- **Lecturers:** Manage assigned course resources, review course-level activity, and create learning materials. Operate within their course scope. Read cohort signals (concept confusion surfaced early from quiz results and what students actually ask), per-offering course analytics, and a quiz drafting queue.
- **Tenant Admins:** Manage institutional structure (faculties, departments, programmes, courses), users, and audit logs. Govern the tenant's configuration, its access rules, announcements, and health indicators.
- **Platform Superusers:** Manage tenants, view cross-tenant analytics, system health, and platform-wide audit logs. Operate at the infrastructure level. Own the institution-request queue (approve/reject).
- **Institution requesters:** Any signed-in user can request a university workspace from the public product without already being a member of one. A self-serve acquisition and onboarding surface, not a role inside a tenant.

Each of the three in-tenant roles has a dedicated agent with its own tools, persona, and visible chain of tool calls — the *Study partner* (student), *Course co-pilot* (lecturer), and *Institution operator* (admin). Guardian keys and personas are defined in `backend/apps/agent/manifest.py`.

## Product Purpose

AcademiAI is a multi-tenant AI-powered academic assistant and intelligent resource hub. It exists because academic resources are fragmented across files, messaging platforms, and conventional LMS tools. Success means students get trusted, course-specific answers grounded in their institution's own materials, while institutions maintain strict data isolation and administrative control.

## Positioning

AcademiAI's differentiator is the combination of three mechanisms that no neighboring product truthfully copies together: (1) AI answers are strictly RAG-grounded in tenant-uploaded resources — no hallucinated content, (2) strict multi-tenant isolation via PostgreSQL RLS — each institution's data and AI retrieval is completely siloed, and (3) a concept-aware retrieval graph that connects related topics across documents for richer, contextually relevant answers.

## Operating Context

- Academic institutions (universities) with a formal hierarchy: Tenant → Faculty → Department → Programme → Course → Course Offering
- Courses are scoped to academic sessions and semesters
- Resources have visibility scopes: private, course, programme, department, faculty, institution
- Document processing is asynchronous (uploaded resources are chunked, embedded, and indexed)
- AI chat uses hybrid retrieval with concept-aware reranking and source citations
- Authentication is JWT-based with email verification
- Deployed via Docker Compose locally; production targets AWS (S3 for object storage)
- The calendar aggregates study plans, lectures, exams, office hours, and institution events in one view (month / week / day / agenda). Timetables arrive from outside the system as CSV or XLSX and are imported behind a preview step; events leave as an RFC-5545 `.ics` download.
- Study plans and milestones are authored manually, from institution or personal templates, or by asking the agent — and then sync into that same calendar
- Lecturers queue the AI against chosen documents to draft quizzes, review the drafts, then publish; attempts flow into mastery records
- Announcements are authored per tenant, dispatched by email, and carry a per-user opt-out
- Students-only usage is separated from staff usage so a lecturer's own activity never inflates cohort metrics (`backend/apps/academics/analytics.py`)

## Capabilities and Constraints

- Course, resource, and user management with role-based access (student, lecturer, tenant_admin, platform superuser)
- AI chat grounded in tenant-authorized resources via pgvector + Gemini
- Concept graph linking related academic topics
- Quiz creation, attempts, and results
- Personal notes, bookmarks, and learning progress tracking
- Audit logging for all significant actions
- Multi-tenancy via shared-schema + PostgreSQL RLS + application-layer filtering
- Asynchronous document processing via Celery + RabbitMQ
- **Study planner:** goals become dated milestones and tasks; authored manually, from institution or personal templates, or by the agent; plan and milestone dates sync to the calendar
- **Layered calendar:** study plans, lectures, exams, office hours, and institution events in one month/week/day/agenda surface; RFC-5545 `.ics` export; timetable import from CSV/XLSX with a preview step
- **Cohort signals:** concept confusion surfaces early from quiz results and what students ask, ranked for lecturers and admins; low cohort averages can trigger notifications
- **Course analytics:** per-offering engagement, quiz performance, resource quality scores, duplicate detection, and topic suggestions, restricted to assigned lecturers
- **Agentic grounded chat:** one agent per in-tenant role with function-calling tools, a persona, and a visible tool-call chain; claims stay traceable to the retrieved sources, so an unsupported question gets an honest miss rather than a fabricated answer
- **Attach files in chat:** a document dropped into a conversation is answered with that file in context
- **Agent personalisation:** custom avatars, tone adjustment, and accessibility-first reading filters (`ableism`, `reading_order`) applied to agent output (`frontend/src/lib/agentFilters.js`)
- **Resume-reading:** reading position and section are remembered per resource
- **Self-serve institution requests:** any user can request a university workspace; approved requests are auto-provisioned as a new tenant
- **Institution announcements:** university-wide announcements with email dispatch and a per-user opt-out
- **Notifications:** per-kind preference toggles so the platform only reaches users the ways they want
- **Platform console:** cross-tenant health, global analytics, RAG evaluation, system logs, and the institution-request queue
- No cross-tenant knowledge retrieval (hard constraint)
- No automated grading of high-stakes exams (non-goal)
- No mastery-based adaptive learning in initial scope (non-goal)
- Never trust a client-supplied `tenant_id`; isolation is enforced in the database, not the request layer
- **Open decision:** the README advertises a third accessibility reading filter, "ITIM", that is not implemented — `agentFilters.js` implements `ableism` and `reading_order` only. Either the filter ships or the README claim is withdrawn; do not record ITIM as a capability until one of those happens.
- **Open decision:** no labelled RAG ground-truth set is curated yet, so no retrieval-quality benchmark number may be claimed anywhere in the product or its marketing.

## Brand Commitments

- Name "AcademiAI" is final
- The brand mark is code-drawn: inline SVG in `BrandMark.jsx` is canonical (theme-aware); static brand SVGs live at `frontend/public/brand/cinnabar-mark-{light,dark}.svg` plus `app-icon.svg` (the maskable source), with adaptive `favicon.svg` and regenerated PNG fallbacks (`favicon-*`, `pwa-*`, `apple-touch-icon`)
- Avatar set exists at `frontend/src/assets/avatars/` (6 assets)
- The formal visual contract is `DESIGN.md` — an established design system, not an open question. Colour, typography, material, and motion decisions belong there and must not be re-litigated inside a product task
- Product/voice truth lives in this file; `DESIGN.md` holds visuals. Neither file restates the other's authority
- The product is proprietary/internal; no public brand or licensing commitment has been made

## Evidence on Hand

- Logo: `frontend/public/brand/cinnabar-mark-light.svg`, `frontend/public/brand/cinnabar-mark-dark.svg`
- Landing imagery: the page is drawn in code, not photography. Section art is inline SVG in `frontend/src/components/shared/landingPlates.jsx` (see `DESIGN.md` → Landing System). The only raster landing asset is `frontend/public/images/landing/hero-academiai-tutor.png`, used as the `og:image` in `frontend/index.html`
- Favicons and PWA icons in `frontend/public/`
- Complete working frontend with shadcn/ui component library and Tailwind v4 design tokens (59 page/view modules under `frontend/src/pages/`)
- Full backend with Django REST Framework, pgvector, Celery workers
- Product requirements: `docs/product/PRD.md` (product, problem, goals, non-goals, roles, hierarchy, functional + non-functional requirements, acceptance principles), with `docs/product/requirements.md` alongside it. **The path previously cited here — `docs/unzipped/AcademiAI-final-agent-package/documentation/docs/product/PRD.md` — no longer exists on disk; the document moved to `docs/product/`.** Other working docs are indexed in `docs/DOCUMENTATION_INDEX.md`
- Code-level proof for the shipped capability set, usable as evidence rather than assertion: role agents and personas `backend/apps/agent/manifest.py`; cohort analytics `backend/apps/academics/analytics.py`; dashboard cohort aggregation `backend/apps/common/dashboard.py`; ICS export `backend/apps/calendar/services/ics.py` + `views.py`; timetable parsing `backend/apps/calendar/services/schedule_parse.py`; reading filters `frontend/src/lib/agentFilters.js`; RLS and tenant isolation `docs/DECISIONS.md`
- **Removed (2026-10-11):** `frontend/public/images/{abuja_campus_sunset,holographic_ai_library_collaboration,ai_knowledge_graph_visualization,brandkit}.webp` were deleted — referenced by no code, and each had disqualifying content baked into the pixels (a fabricated "94.2% accuracy" metric, a real "UC Berkeley" name, unverifiable "1536-dim / UMAP / MTEB" claims, real "ABUJA UNIVERSITY" signage, or a competing brand spec). Do not re-add them
- **No customer evidence exists.** No testimonials, named institutional customers, case studies, press, or usage benchmarks are on hand, and none may be invented for demos or marketing
- **No RAG quality benchmark exists** until a labelled ground-truth set is curated and `manage.py evaluate_rag` is run

## Product Principles

1. **Grounded truth over fluency.** AI answers must be traceable to uploaded sources; hallucinated content is a worse failure than no answer.
2. **Institutional sovereignty.** Each tenant's data, AI, and configuration is completely isolated — no leakage, no cross-tenant inference.
3. **Hierarchy mirrors reality.** The faculty → department → programme → course structure reflects how institutions actually operate, not how developers think about data.
4. **Audit everything.** Every significant action is logged; trust is verified, not assumed.
5. **Asynchronous by default.** Document processing, email, and heavy AI work happen in background jobs — the UI never blocks on infrastructure.

## Accessibility & Inclusion

- **WCAG 2.2 AA is the named, checkable bar.** Conformance is verifiable in an audit; "accessible" without that target is a matter of taste.
- Accessibility is a first-class product commitment, not an implementation detail — the product serves students reading with assistive technology, dyslexia-aware readers, and users whose first language is not the interface language.
- **Accessibility-first reading filters are a product feature, shipped in the agent surface:** `ableism` (neutral substitutes for ableist idioms) and `reading_order` (bidirectional override handling and RTL reordering) are applied to agent output via `frontend/src/lib/agentFilters.js`. A third filter, "ITIM", is advertised in the README but not implemented — see the open decision under Capabilities and Constraints.
- `DESIGN.md`'s Accessibility section is the implementation floor that supports the AA target: semantic landmarks, visible focus rings, no keyboard traps, `aria-live` for dynamic content, status never conveyed by colour alone, and full `prefers-reduced-motion` support. DESIGN.md implements the bar; it does not define it.
- Both light and dark themes are first-class, and neither may be shipped in a state that fails contrast at either.

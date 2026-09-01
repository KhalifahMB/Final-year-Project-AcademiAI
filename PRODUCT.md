# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students:** Use the AI assistant to ask grounded course questions, manage notes and bookmarks, take quizzes, and track learning progress. Primary daily users.
- **Lecturers:** Manage assigned course resources, review course-level activity, and create learning materials. Operate within their course scope.
- **Tenant Admins:** Manage institutional structure (faculties, departments, programmes, courses), users, and audit logs. Govern the tenant's configuration.
- **Platform Superusers:** Manage tenants, view cross-tenant analytics, system health, and platform-wide audit logs. Operate at the infrastructure level.

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

## Capabilities and Constraints

- Course, resource, and user management with role-based access (student, lecturer, tenant_admin, platform superuser)
- AI chat grounded in tenant-authorized resources via pgvector + Gemini
- Concept graph linking related academic topics
- Quiz creation, attempts, and results
- Personal notes, bookmarks, and learning progress tracking
- Audit logging for all significant actions
- Multi-tenancy via shared-schema + PostgreSQL RLS + application-layer filtering
- Asynchronous document processing via Celery + RabbitMQ
- No cross-tenant knowledge retrieval (hard constraint)
- No automated grading of high-stakes exams (non-goal)
- No mastery-based adaptive learning in initial scope (non-goal)

## Brand Commitments

- Name "AcademiAI" is final
- Logo assets exist at `frontend/public/images/Logo/` (light and dark variants)
- Avatar set exists at `frontend/src/assets/avatars/`
- No formal brand guidelines, color mandates, or style guide yet

## Evidence on Hand

- Logo: `frontend/public/images/Logo/academiai_icon_light.webp`, `academiai_icon_dark.png`
- Hero/landing images: `frontend/public/images/landing/hero-academiai-tutor.png`, `abuja_campus_sunset.webp`, `holographic_ai_library_collaboration.webp`, `ai_knowledge_graph_visualization.webp`
- Favicons and PWA icons in `frontend/public/`
- Complete working frontend with shadcn/ui component library and Tailwind v4 design tokens
- Full backend with Django REST Framework, pgvector, Celery workers
- Product requirements documented in `docs/unzipped/AcademiAI-final-agent-package/documentation/docs/product/PRD.md`

## Product Principles

1. **Grounded truth over fluency.** AI answers must be traceable to uploaded sources; hallucinated content is a worse failure than no answer.
2. **Institutional sovereignty.** Each tenant's data, AI, and configuration is completely isolated — no leakage, no cross-tenant inference.
3. **Hierarchy mirrors reality.** The faculty → department → programme → course structure reflects how institutions actually operate, not how developers think about data.
4. **Audit everything.** Every significant action is logged; trust is verified, not assumed.
5. **Asynchronous by default.** Document processing, email, and heavy AI work happen in background jobs — the UI never blocks on infrastructure.

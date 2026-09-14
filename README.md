<div align="center">

<img src="frontend/public/images/Logo/academiai_icon_light.webp" alt="AcademiAI logo" width="96" height="96" />

# AcademiAI

**Multi-tenant AI academic assistant** — grounded answers, study planning, and a layered calendar for every institution.

_Built with Django · DRF · React · pgvector · Google Gemini_

</div>

---

## About

AcademiAI is an AI-powered academic assistant and intelligent resource hub for
universities. Academic materials are fragmented across files, messaging apps,
and conventional LMS tools — so students never get trusted, course-specific
answers. AcademiAI brings a university's classes, materials, AI tutor, study
planner, and calendar into one isolated workspace.

Every answer is **grounded** in the institution's own authorised resources.
When AcademiAI cites a claim it points to the exact page and passage it came
from — no hallucinations, no cross-tenant leakage.

### What it does

- **Grounded AI chat** — a personal agent that retrieves from course materials
  using hybrid search (semantic + lexical + concept reranking) and cites every
  source with a similarity score.
- **Role agents** — one agent per working role: a *Study partner* for students,
  a *Course co-pilot* for lecturers, and an *Institution operator* for
  administrators. Each has tools, a persona, and a visible chain of tool calls.
- **Study planner (Plans)** — goals become dated milestones and tasks. Create
  plans manually, from institution or personal templates, or ask the agent to
  build one. Plans and mileststones sync to the calendar.
- **Layered calendar** — study plans, lectures, exams, office hours, and
  institution events in one view (month / week / day / agenda). Exports ICS,
  imports timetables from CSV or XLSX with a preview step.
- **Quizzes from your materials** — lecturers queue the AI against chosen
  documents, review drafts, then publish; attempts flow into mastery records.
- **Cohort signals** — concept confusion surfaces early from quiz results and
  what students ask, ranked for lecturers and admins.
- **Course analytics** — per-offering analytics give lecturers resource
  quality scores, duplicate detection, topic suggestions, and confusion ranked
  by real usage.
- **Attach files in chat** — drop a document into a conversation and the
  agent answers with that file in context.
- **Agent personalisation** — custom avatars, tone adjustments, and
  accessibility-first reading filters (ableism, reading order, ITIM).
- **Resume-reading** — reading positions remember your scroll position and
  section in every resource.
- **Self-serve institution requests** — any user can request a university
  workspace; approved requests are auto-provisioned as a new tenant.
- **Institution announcements** — university-wide announcements with email
  dispatch and a per-user opt-out.
- **Admin + audit** — institutional hierarchy, access rules, users, logs, and a
  platform console for cross-tenant health and analytics.
- **Notifications** — per-kind preference toggles so the platform only reaches
  you the ways you want.

### Why it's different

1. **RAG-grounded by design** — answers are strictly retrieved from
   tenant-uploaded resources; hallucinated content is treated as a worse
   failure than no answer.
2. **Hard multi-tenant isolation** — PostgreSQL Row-Level Security plus
   application-layer filtering keep every institution's data and AI retrieval
   completely siloed.
3. **Concept-aware retrieval** — a knowledge graph connects related topics
   across documents for richer, contextually relevant answers.

---

## Tech stack

| Layer       | Technology                                   |
|-------------|-----------------------------------------------|
| Backend     | Python · Django 6 · Django REST Framework     |
| Database    | PostgreSQL + pgvector (vector search)         |
| AI          | Google Gemini (chat, embeddings, agentic loop)|
| Task queue  | Celery + RabbitMQ (broker) + Redis (cache)    |
| Object store| MinIO (local) / AWS S3 (production)           |
| Frontend    | React 19 · Vite · JavaScript · Tailwind v4    |
| Components  | shadcn/ui (Radix) · lucide-react              |
| Auth        | JWT (SimpleJWT) with email verification       |
| API docs    | OpenAPI 3 via drf-spectacular                 |

---

## Quick start

See [`SETUP.md`](SETUP.md) for full local setup instructions, and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for coding conventions, test
commands, and git workflow.

---

## Project layout

```
academiai/
├── backend/                 # Django modular monolith
│   ├── config/              # settings, urls, celery, wsgi
│   ├── apps/
│   │   ├── accounts/        # users, JWT, email verification
│   │   ├── tenants/         # multi-tenant workspaces, RLS
│   │   ├── academics/       # faculty → department → programme → course
│   │   ├── resources/       # uploads, chunking, visibility scopes
│   │   ├── knowledge/       # embeddings, retrieval graph
│   │   ├── chat/            # grounded RAG chat + citations
│   │   ├── assessments/     # quizzes, attempts, results
│   │   ├── learning/        # plans, milestones, tasks, progress
│   │   ├── agent/           # role agents + function-calling tools
│   │   ├── calendar/        # layered calendar, ICS, timetable import
│   │   ├── audit/           # audit logs
│   │   ├── logs/            # tenant request logs + log analyzer
│   │   ├── notifications/   # notification prefs + engine
│   │   ├── platform/        # platform-wide health endpoints
│   │   └── common/          # shared AI + management commands
│   ├── manage.py
│   └── requirements.txt
├── frontend/                # React + Vite SPA (see docs/FRONTEND_STACK.md)
├── docs/                    # design + working docs (see DOCUMENTATION_INDEX.md)
├── docker-compose.yml
├── .env.example
├── SETUP.md                 # local quick-start
└── AGENTS.md                # agent guidance (read before deep work)
```

---

## Multi-tenancy

Shared-schema with `tenant_id` on every scoped entity + PostgreSQL RLS +
application-layer filtering + object-level permissions. **Never trust a
client-supplied `tenant_id`** — isolation is enforced at the database level.
The app DB role is non-superuser without `BYPASSRLS`; see [DECISIONS.md](docs/DECISIONS.md).

---

## Testing

See [`SETUP.md`](SETUP.md) for the full test setup (Docker DB required for
backend tests) and [`CONTRIBUTING.md`](CONTRIBUTING.md) for running commands.

---

## RAG evaluation

A labelled ground-truth set is required to measure retrieval quality:

```bash
cd backend
python manage.py evaluate_rag --queries rag_queries.json --k 5
```

See the docstring in `apps/common/management/commands/evaluate_rag.py` for the
query file format. No benchmark numbers are claimed until a labelled dataset
is curated and evaluated.

---

## Documentation

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — recorded specification decisions.
- [`docs/DEV.md`](docs/DEV.md) — current development status + command cheatsheet.
- [`docs/FRONTEND_STACK.md`](docs/FRONTEND_STACK.md) — screen + component inventory.
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — build plan.
- [`docs/PRODUCT_ROADMAP.md`](docs/PRODUCT_ROADMAP.md) — product roadmap.
- [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) — full index.
- Brand contract: `DESIGN.md` (visuals) + `PRODUCT.md` (product/voice).

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## License

Proprietary — internal project.
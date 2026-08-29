# AcademiAI

Multi-tenant academic AI platform (Django + DRF + React + pgvector + Gemini).

## Stack (authoritative)

- Backend: Python, Django, Django REST Framework
- Database: PostgreSQL + pgvector
- Task broker: RabbitMQ
- Cache: Redis
- Object storage: MinIO (local) / AWS S3 (production)
- AI: Google Gemini
- Frontend: React + Vite + JavaScript + Tailwind CSS + shadcn/ui
- Auth: JWT (SimpleJWT)
- API docs: OpenAPI 3 via drf-spectacular

## Quick start (local)

### 1. Infrastructure

```bash
cp .env.example .env
docker compose up -d
```

Services:

- PostgreSQL + pgvector → `localhost:5432`
- Redis → `localhost:6379`
- RabbitMQ → `localhost:5672` (management UI `:15672`)
- MinIO → `localhost:9000` (console `:9001`)

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py apply_rls   # enables PostgreSQL Row-Level Security policies
python manage.py createsuperuser
python manage.py runserver
```

> **Important:** the database role used by the app (`POSTGRES_USER`) must be a
> non-superuser without `BYPASSRLS` (default `academiai_app`, created
> automatically on first `docker compose` DB start). Otherwise RLS is not
> enforced. Tests require `CREATEDB` for pytest-django; revoke it in production.

Celery worker (separate terminal):

```bash
cd backend
source .venv/bin/activate
celery -A config worker -l INFO -P solo -Q ai,celery,email,ingestion
```

> **Windows note:** Celery's default prefork pool crashes on Windows
> (`PermissionError: [WinError 5]` / `OSError: [WinError 6]` from billiard).
> On win32 the project automatically switches the worker to the `solo` pool
> (tasks run sequentially in-process) — see `config/celery.py`. Set
> `CELERY_FORCE_PREFORK=1` only if you know you need prefork. Inside Docker
> (Linux) the default pool is used unchanged.

API docs: http://localhost:8000/api/schema/swagger-ui/

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Project layout

```
academiai/
├── backend/                 # Django modular monolith
│   ├── config/              # settings, urls, celery, wsgi
│   ├── apps/
│   │   ├── accounts/
│   │   ├── tenants/
│   │   ├── academics/
│   │   ├── resources/
│   │   ├── knowledge/
│   │   ├── chat/
│   │   ├── assessments/
│   │   ├── learning/
│   │   ├── audit/
│   │   └── common/
│   ├── manage.py
│   └── requirements.txt
├── frontend/                # React + Vite
├── docker-compose.yml
├── .env.example
└── docs/                    # copied / linked design docs
```

## Multi-tenancy

Shared-schema with `tenant_id` on every scoped entity + PostgreSQL RLS + application-layer filtering + object-level permissions. Never trust a client-supplied `tenant_id`.

## Tests

Backend (requires the Docker DB running):

```bash
cd backend
.venv\Scripts\python -m pytest -q
```

Frontend:

```bash
cd frontend
npm test
```

Coverage includes: auth flow (signup → verify → login → me), password reset
(single-use, no enumeration), cross-tenant API isolation/IDOR, database-level
RLS (read/insert/update denial), retrieval authorization units, RRF fusion,
RAG evaluation metrics, document extraction, upload validation, and frontend
routing/role-gate/login tests.

## RAG evaluation

A labelled ground-truth set is required to measure retrieval quality:

```bash
cd backend
python manage.py evaluate_rag --queries rag_queries.json --k 5
```

See the docstring in `apps/common/management/commands/evaluate_rag.py` for the
query file format. No benchmark numbers are claimed until a labelled dataset
is curated and evaluated.

## Implementation decisions

See `docs/DECISIONS.md` for recorded specification decisions and deviations
(RLS role model, users-table exclusion, job status surface, etc.).

## License

Proprietary — internal project.

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
python manage.py createsuperuser
python manage.py runserver
```

Celery worker (separate terminal):

```bash
cd backend
source .venv/bin/activate
celery -A config worker -l info -Q ai,ingestion,email,celery
```

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

## License

Proprietary — internal project.

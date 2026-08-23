# AcademiAI

**Final year Project: AcademiAI**

Multi-tenant academic AI platform (Django + DRF + React + pgvector + Gemini).

## Stack

- Backend: Python, Django, Django REST Framework
- Database: PostgreSQL + pgvector
- Task broker: RabbitMQ | Cache: Redis
- Object storage: MinIO (local) / AWS S3 (production)
- AI: Google Gemini
- Frontend: React + Vite + JavaScript + Tailwind CSS + shadcn/ui
- Auth: JWT (SimpleJWT)
- API docs: OpenAPI 3 via drf-spectacular

## Branch

Active development: **`dev`**

## Local quick start

```bash
cp .env.example .env
docker compose up -d
cd backend && pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
# celery -A config worker -l info -Q ai,ingestion,email,celery
cd ../frontend && npm install && npm run dev
```

Demo admin (after seed_demo): `admin@demo.local` / `DemoAdmin123!`

API docs: http://localhost:8000/api/schema/swagger-ui/

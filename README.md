# AcademiAI

**Final year Project: AcademiAI** — Multi-tenant academic AI platform.

## Stack
Django + DRF · PostgreSQL + pgvector · RabbitMQ · Redis · MinIO/S3 · Gemini · React + Vite + JS

## Full source

Complete tree is on branch `dev` (local commits through `0acae01`) and as a zip on Google Drive:

**AcademiAI-source-full.zip** — upload from agent session.

## Quick start

```bash
cp .env.example .env
docker compose up -d
cd backend && pip install -r requirements.txt
python manage.py migrate
python manage.py apply_rls
python manage.py seed_demo
python manage.py runserver
# celery -A config worker -l info -Q ai,ingestion,email,celery
cd ../frontend && npm install && npm run dev
```

Demo: `admin@demo.local` / `DemoAdmin123!`

See `VERIFICATION.md` and `DEV.md`.

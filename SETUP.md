# SETUP.md — local development quick-start

Single-file guide to run the full **AcademiAI** stack on your machine.
See `README.md` for the complete, authoritative setup and `docs/DEV.md` for
status and command cheatsheet.

Stack: Django + DRF (backend) · React + Vite (frontend) · PostgreSQL + pgvector
· Redis · RabbitMQ · MinIO · Google Gemini.

> **Windows note (PowerShell):** never chain commands with `&&`. Use `;`
> or `cmd1; if ($?) { cmd2 }`. Backend Python lives in a venv — call it
> explicitly with `backend\.venv\Scripts\python.exe`, don't rely on `python`.

## 0. Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- Docker + Docker Compose
- Git

## 1. Infrastructure (Docker)

```powershell
Copy-Item .env.example .env
docker compose up -d
```

Services (defaults from `.env.example`):

| Service            | URL / port                  |
|--------------------|-----------------------------|
| PostgreSQL+pgvector| `localhost:5432`            |
| Redis              | `localhost:6379`            |
| RabbitMQ           | `localhost:5672` (UI `:15672`) |
| MinIO              | `localhost:9000` (console `:9001`) |

## 2. Backend

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt   # first time / after deps change
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py apply_rls                  # REQUIRED after migrate
.\.venv\Scripts\python.exe manage.py createsuperuser            # optional
.\.venv\Scripts\python.exe manage.py runserver                  # :8000
```

> **RLS:** the app DB role must be non-superuser **without `BYPASSRLS`**
> (default `academiai_app`). Otherwise multi-tenant isolation is not enforced.
> Run `apply_rls` after every `migrate`.

Celery worker (separate terminal):

```powershell
cd backend
.\.venv\Scripts\python.exe -m celery -A config worker -l INFO -P solo -Q ai,celery,email,ingestion
```

API docs: http://localhost:8000/api/schema/swagger-ui/

## 3. Frontend

```powershell
cd frontend
npm install            # first time
npm run dev            # Vite :5173, proxies /api -> localhost:8000
```

App: http://localhost:5173

## 4. Verify

```powershell
# Backend (needs the Docker DB up)
cd backend
.\.venv\Scripts\python.exe manage.py smoke_check --with-db
.\.venv\Scripts\python.exe manage.py seed_demo                # demo tenant
.\.venv\Scripts\python.exe -m pytest -q -o addopts="-p no:xdist"

# Frontend
cd frontend
npm run lint
npm run build
npm test
```

## 5. Common gotchas

- **Tests require the Docker DB** — they are not offline-safe.
- **Test timeout:** routing tests can flake under load; raise
  `--testTimeout=120000` if needed.
- **Celery on Windows** auto-uses the `solo` pool (`config/celery.py`);
  don't "fix" it.
- Theming lives in `frontend/src/index.css` (Tailwind v4 CSS-first tokens) —
  do **not** edit `tailwind.config.js` to change app colors.

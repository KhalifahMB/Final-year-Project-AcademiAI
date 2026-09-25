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
```

Before the first `docker compose up -d`, set `ACADEMIAI_DEV_TEST_ROLE=1` in your
`.env` on a development machine — that creates the `BYPASSRLS` role the backend
test suite connects as (see `infrastructure/postgres/init/02-test-role.sh`). Leave
it at `0` anywhere tenant isolation must actually be enforced.

```powershell
docker compose up -d
```

Services (defaults from `.env.example`):

| Service             | URL / port                         |
| ------------------- | ---------------------------------- |
| PostgreSQL+pgvector | `localhost:5432`                   |
| Redis               | `localhost:6379`                   |
| RabbitMQ            | `localhost:5672` (UI `:15672`)     |
| MinIO               | `localhost:9000` (console `:9001`) |

## 2. Backend

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt   # first time / after deps change
.\.venv\Scripts\python.exe manage.py migrate                    # auto-enforces RLS via post_migrate
.\.venv\Scripts\python.exe manage.py createsuperuser            # optional
.\.venv\Scripts\python.exe manage.py runserver                  # :8000
```

> **RLS:** the app DB role must be non-superuser **without `BYPASSRLS`**
> (default `academiai`). Otherwise multi-tenant isolation is not enforced —
> the compose stack creates a separate `postgres` superuser for bootstrap and
> the non-superuser `academiai` app role (see
> `infrastructure/postgres/init/01-app-role.sql`). A third script there,
> `02-test-role.sh`, creates the `BYPASSRLS` role pytest uses, and only when
> `ACADEMIAI_DEV_TEST_ROLE=1` — it is a temporary shim while unscoped test
> fixtures are converted, never a deployment role. RLS policies are applied
> automatically on every `migrate` (a `post_migrate` receiver), so there is no
> separate `apply_rls` step.

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
.\.venv\Scripts\python.exe -m pytest -q

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

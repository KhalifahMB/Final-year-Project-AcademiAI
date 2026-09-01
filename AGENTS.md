# AGENTS.md

AcademiAI: multi-tenant academic AI platform. Monorepo = **Django REST backend** (`backend/`) + **React SPA** (`frontend/`).

## Environment (Windows + PowerShell 5.1)

- Default shell is PowerShell. **Do not use `&&`** — chain with `;` or `cmd1; if ($?) { cmd2 }`.
- Backend Python is already in a venv: use `backend\.venv\Scripts\python.exe` explicitly (don't rely on `python` on PATH).
- `.env`, `.venv/`, `node_modules/`, `.opencode/`, `.impeccable/` are all gitignored.

## Backend (Django + DRF)

- Modular monolith: apps under `backend/apps/` (`accounts`, `tenants`, `academics`, `resources`, `knowledge`, `chat`, `assessments`, `learning`, `audit`, `common`). Config in `backend/config/`.
- Custom management commands live in `backend/apps/common/management/commands/` (`apply_rls`, `seed_demo`, `smoke_check`, `evaluate_rag`, `setup_dlq`). Put new admin commands there, not a random app.

```bash
cd backend
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py apply_rls   # REQUIRED after migrate; enables RLS policies
.\.venv\Scripts\python.exe manage.py runserver    # serves :8000
.\.venv\Scripts\python.exe -m pytest -q           # tests; requires Docker DB running
```

- **Tests need the Docker DB up** (`docker compose up -d`). They are NOT offline-safe. Backend tests: `cd backend && .\.venv\Scripts\python.exe -m pytest -q` (may need `-p no:xdist` if pytest-xdist missing).
- **Never trust a client-supplied `tenant_id`** — isolation is enforced by PostgreSQL RLS + application-layer filtering + object permissions (shared-schema multi-tenancy). The app DB role must be non-superuser without `BYPASSRLS`.
- **Celery on Windows auto-switches to the `solo` pool** (`config/celery.py`) because prefork crashes on win32. Don't "fix" that.

## Frontend (React 19 + Vite 8, plain JavaScript — no TypeScript)

- Run from `frontend/`:
```bash
cd frontend
npm run dev       # Vite dev :5173, proxy /api -> localhost:8000
npm run lint      # oxlint — the linter (NOT eslint)
npm run build     # vite build (no tsc/typecheck step; it's JS)
npm test          # vitest, happy-dom env
```
- `@` alias → `frontend/src` (see `vite.config.js`).
- **Theming source of truth:** `frontend/src/index.css` — Tailwind **v4 CSS-first** with `oklch()` tokens defined as CSS custom properties (`--bg`, `--surface`, `--fg`, `--accent`, etc.). The `tailwind.config.js` maps these colors for shadcn CLI/intellisense **only** — do NOT edit it to change app colors; change the tokens in `index.css`.
- shadcn/ui (Radix) primitives in `components/ui/`; shared app components in `components/shared/`. Icons: `lucide-react`.
- **Design contract:** `DESIGN.md` (glass-first premium material system) + `PRODUCT.md` are authoritative for visuals/voice. Follow them; both light and dark themes are first-class (tokens only, no hardcoded hues).

## Working docs (read before deep work)

- `README.md` — authoritative stack + full local setup (infra, backend, frontend, tests).
- `docs/DEV.md` — dev-status + command cheatsheet. `docs/DECISIONS.md` — recorded spec decisions.
- `docs/FRONTEND_STACK.md` — screen inventory + shared-component inventory.
- `frontend/src/services/api.js` — axios JWT client wrapping the DRF API (`/api/v1`).

## Design verification

When editing UI, the Impeccable detector finds design regressions the linter won't:
```bash
node .opencode/skills/impeccable/scripts/detect.mjs --json <file>
```
Run `npm run lint` + `npm run build` after UI/JSX edits; both must stay clean before finishing.

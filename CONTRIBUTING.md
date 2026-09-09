# Contributing to AcademiAI

Thanks for contributing! This project is a multi-tenant academic AI platform
with a Django REST backend and a React SPA. Please read this guide before
opening a PR.

## Environment

- **Windows + PowerShell 5.1** is the default shell. Never chain commands with
  `&&` — use `;` or `cmd1; if ($?) { cmd2 }`.
- Backend Python lives in a venv. Call it explicitly:
  `backend\.venv\Scripts\python.exe` — don't rely on `python` on PATH.
- Theming is **CSS-first** (Tailwind v4 tokens in `frontend/src/index.css`) —
  do not edit `tailwind.config.js` to change app colors.

See [`SETUP.md`](SETUP.md) and [`README.md`](README.md) for full local setup.

## Branching & workflow

1. Work on a feature branch off `main` (e.g. `feat/xyz`). Keep the current
   active branch (currently `feat/premium`) in sync before branching.
2. Make **logical, reviewable commits** — one concern per commit.
3. After each logical change, commit with the project's conventional style
   (see below).
4. Open a pull request against the base branch when the change is complete and
   all checks pass.

## Commit convention

Use the conventional-commit format:

```
type(scope): short summary
```

Examples from the repo history:

```
phase 1
phase 2
UI Fix and notification
ready for design-signoff
```

Prefer explicit types (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
`style`) with a scope where useful — e.g. `feat(calendar): add timetable import`.

## Before you commit

- **Never commit secrets.** `.env`, `.venv/`, `node_modules/`, `.opencode/`,
  and `.impeccable/` are gitignored — keep them that way. Never force-add them.
- **Run the linter and build for frontend changes** (from `frontend/`):

  ```powershell
  npm run lint    # oxlint — this is the linter (NOT eslint)
  npm run build   # vite build
  ```

- **For UI edits**, run the design detector on changed files:

  ```powershell
  node .opencode/skills/impeccable/scripts/detect.mjs --json <file>
  ```

  A clean result prints `[]`. Read `DESIGN.md` / `PRODUCT.md` before deep UI work.

- **Run backend checks** (from `backend/`):

  ```powershell
  .\.venv\Scripts\python.exe -m pytest -q
  ```

  Tests require the Docker DB running (they are **not offline-safe**): first
  run `docker compose up -d`.

## Migrations & RLS

- After any model change, create and run migrations, then **re-apply RLS**:

  ```powershell
  cd backend
  .\.venv\Scripts\python.exe manage.py makemigrations
  .\.venv\Scripts\python.exe manage.py migrate
  .\.venv\Scripts\python.exe manage.py apply_rls   # REQUIRED after migrate
  ```

- New management commands belong in
  `backend/apps/common/management/commands/`.

## Multi-tenancy rules

- **Never trust a client-supplied `tenant_id`.** Isolation is enforced by
  PostgreSQL RLS + application-layer filtering + object permissions. The app DB
  role must be non-superuser without `BYPASSRLS`.
- If you introduce a new tenant-scoped model, add `tenant_id` and confirm RLS
  policies cover it.

## Frontend conventions

- Plain JavaScript — **no TypeScript**.
- `@` alias → `frontend/src`.
- shadcn/ui (Radix) primitives live in `components/ui/`; shared app components
  in `components/shared/`. Icons: `lucide-react`.
- Follow the design contract in `DESIGN.md` (visuals) and `PRODUCT.md`
  (voice/copy). Both light and dark themes are first-class — tokens only, no
  hardcoded hues.

## Backend conventions

- Modular monolith: add features to the relevant app under `backend/apps/`
  rather than scattering logic.
- Consult `docs/DECISIONS.md` for recorded architectural decisions before
  changing shared behaviour (RLS role model, job status surface, etc.).

## Docs

- Keep `README.md`, `SETUP.md`, and the living docs under `docs/` accurate when
  behaviour or the project layout changes.
- Dated session notes and working audits belong under `docs/archive/` — not in
  the living docs.

## Code of conduct

Be respectful and constructive. Assume good intent, review in good faith, and
keep discussion focused on the work.
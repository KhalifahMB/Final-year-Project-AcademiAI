# AcademiAI development status

## Completed

| Phase | Content |
|-------|---------|
| A–G | Foundation through merge polish |
| H | Initial Django migrations |
| I | E2E smoke prep + AppShell UI polish |
| Phase 1 | 3-role agents consolidation, avatar upload, dashboard gaps, rebrand scrub |
| Phase 2 | Analytics/log-analyzer, upload wizard, notifications prefs, landing nav cohesion, docs tidy |
| Landing | What-is, Agents, Planner, Calendar, Platform-depth, Photo-band, Case-study sections; unified section spacing |
| Docs audit | FRONTEND_STACK rewritten (46 screens, 18 components), documentation gap audit, AI slop cleanup |

## Current state

- **Backend:** modular monolith under `backend/apps/` (accounts, tenants, academics, resources, knowledge, chat, assessments, learning, agent, calendar, audit, logs, notifications, platform, common)
- **Frontend:** React 19 + Vite 8 SPA with 46 page components across 4 directories; role-gated routing
- **Landing page:** 13 sections with nav cohesion, design-system compliant (impeccable clean)
- **Seed commands:** `seed_demo` (generic), `seed_atbu` / `seed_atbu_lecturers` (institution-specific)

## Commands

```bash
# Backend — needs Docker DB running
cd backend
docker compose up -d
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py apply_rls
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py runserver
.\.venv\Scripts\python.exe -m pytest -q -o addopts="-p no:xdist"

# Frontend
cd frontend
npm run dev          # Vite dev :5173
npm run lint         # oxlint
npm run build        # vite build
npm test -- --run    # vitest

# Design verification
node .opencode/skills/impeccable/scripts/detect.mjs --json <file>
```

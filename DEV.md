# AcademiAI development status

## Completed

| Block | Content |
|-------|---------|
| A–G | Foundation through merge polish |
| H | Initial Django migrations (`256925f`) |
| I | E2E smoke prep + AppShell UI polish (**this phase**) |

## Remaining (~1–2 phases)

1. **Live stack** — `docker compose up` → `migrate` → `apply_rls` → `seed_demo` → runserver + celery  
2. **Run** `python manage.py smoke_check --with-db` and `./scripts/e2e_smoke.sh`  
3. Optional: deeper frontend (shadcn), PDF/OCR, expanded tests  

## Commands

```bash
# Offline
cd backend && python manage.py smoke_check

# With stack
docker compose up -d
python manage.py migrate && python manage.py apply_rls && python manage.py seed_demo
python manage.py smoke_check --with-db
./scripts/e2e_smoke.sh
```

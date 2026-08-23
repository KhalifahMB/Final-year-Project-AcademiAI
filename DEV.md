# AcademiAI development status

## Completed (merged phases)

| Block | Content | Commit tip |
|-------|---------|------------|
| A Foundation | Monorepo, Docker infra, models, auth, academics CRUD | f3c1ccf |
| B API + AI + RAG | Chat, quizzes, hybrid retrieval, Gemini, ingestion | 23f07db |
| C Security | RLS SQL, isolation tests, audit hooks | b61cd76+ |
| D Jobs + core UI | Job status, resources/quizzes/chat, seed_demo | 1dc66a4 |
| E UX auth surfaces | Signup, verify, password reset, courses, dashboard | 6d5339c–0e23792 |
| F Ops packaging | Dockerfiles, compose app profile | 05512e9 |
| G Merge polish | Admin, tests, docs tracker | 6980a18 |
| H DB migrations | Initial migrations all apps; User.email unique; admin field fixes | **256925f** |

## Remaining

1. **Apply migrations + RLS on live Postgres** — requires Docker: `docker compose up -d` → `migrate` → `apply_rls` → `seed_demo`
2. **E2E smoke path** — signup → verify → upload → chat → quiz
3. **Frontend polish** — shadcn, upload UX, loading states
4. **Hardening** *(optional)* — PDF/OCR, malware scan, expanded API tests

**~2–3 phases** left for a defense-ready local demo (1–2 if infra is already available on your machine).

## Your machine (phase H apply)

```bash
cp .env.example .env
docker compose up -d
cd backend && pip install -r requirements.txt
python manage.py migrate
python manage.py apply_rls
python manage.py seed_demo
python manage.py runserver
# celery -A config worker -l info -Q ai,ingestion,email,celery
```

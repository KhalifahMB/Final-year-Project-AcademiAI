# AcademiAI development status

## Completed (merged phases)

| Block | Content | Local commits (examples) |
|-------|---------|---------------------------|
| A Foundation | Monorepo, Docker infra, models, auth, academics CRUD | f3c1ccf |
| B API + AI + RAG | Chat, quizzes, hybrid retrieval, Gemini, ingestion | 23f07db |
| C Security | RLS SQL, isolation tests, audit hooks | b61cd76, 05512e9 |
| D Jobs + core UI | Job status, resources/quizzes/chat, seed_demo | 1dc66a4 |
| E UX auth surfaces | Signup, verify, password reset, courses, dashboard | 6d5339c–0e23792 |
| F Ops packaging | Dockerfiles, compose app profile, deps | 05512e9 |

## Remaining (recommended order)

1. **Database migrations + RLS apply** — `makemigrations` / `migrate` / `apply_rls` against live Postgres+pgvector (blocked without running DB in CI sandbox).
2. **End-to-end verification** — docker compose up, seed, signup→verify→upload→chat→quiz smoke path.
3. **Frontend polish** — shadcn/ui components, loading/error states, protected route UX consistency.
4. **Hardening** — malware scan hook, OCR/PDF extraction, stronger quiz schema validation, production env checklist.
5. **Test suite expansion** — API integration tests with pytest-django + factory fixtures.
6. **GitHub full tree sync** — `git push origin dev` from an authenticated machine.

Roughly **3–4 merged phases** remain before a defense-ready local demo; **5–6** if counting polish + hardening separately.

# Contributing

1. Work on branch `dev`.
2. After each logical change: `git add . && git commit -m "type(scope): message"`.
3. Do not commit secrets (`.env`).
4. Run tests: `cd backend && pytest`.
5. Apply RLS only after migrations: `python manage.py apply_rls`.

# Implementation completion checklist (PRD + frontend.md)

## Backend
- [x] Auth full surface + admin user list/patch
- [x] Hierarchy CRUD APIs
- [x] Resources + presign + complete_upload + summarize
- [x] PDF text extraction (pypdf) + file validation + EICAR/clamd hook
- [x] Hybrid RAG + concept signal + citations
- [x] Quizzes async + attempts
- [x] Notes/bookmarks/progress
- [x] Audit logs
- [x] RLS SQL + vector index SQL
- [x] Celery queues, job status, health
- [x] Migrations generated

## Frontend
- [x] Tailwind + shadcn/ui primitives
- [x] TanStack Query
- [x] Student screens (dashboard, programme, my courses, catalogue, details, resources, chat, quiz, notes, bookmarks, progress, profile)
- [x] Lecturer (assigned, upload)
- [x] Admin (users, faculties, departments, programmes, courses, offerings, enrollments, audit, tenant)

## Operator (your machine)
- [ ] docker compose up + migrate + apply_rls + seed_demo
- [ ] npm install && runserver

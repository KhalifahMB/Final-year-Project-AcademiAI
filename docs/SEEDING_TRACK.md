# Database Seeding — Track Sheet

Tracking the seed/database setup work per institution. One row per institution.

| # | Task | Institution (slug) | Status | Notes |
|---|------|--------------------|--------|-------|
| 1 | Fetch tenant detail | ATBU | Done | Tenant already in DB (see below). |
| 2 | Seed real Faculties + Departments + Programmes | ATBU | Done | `seed_atbu` command; 7 real faculties, 43 depts, 57 progs (incl. 1 placeholder FOC prog). |
| 3 | Seed Computer Science lecturers | ATBU | Done | `seed_atbu_lecturers`; 8 new CS lecturers (staff no. LEC/CS/001-008) linked to DOC, dept of Faculty of Computing FOC. Password: `ATBUtest123!`. |
| 4 | Session / Semester current state | ATBU | Done | Session `2025/2026` (current). Created **Second Semester** (2026-09-12 → 2027-01-01, current); First Semester (2026-08-24 → 2026-09-11) no longer current. |
| 5 | Enforce single current semester/session | ATBU | Done | Bug: two semesters were `is_current=True`. Fixed via model `save()` override (auto-clears siblings) + auto-set latest-as-current in viewset `perform_create` + data migration `0004` (dedupes existing violations). Session `2025/2026` + **Second Semester** are the single current ones. |
| 6 | Edit session & semester in Academic calendar | ATBU | Done | Added Edit buttons + edit dialogs for sessions and semesters in `TenantStructurePage.jsx` (PATCH to `/academic-sessions/:id/` and `/semesters/:id/`). |

## Task 1 — ATBU tenant detail

Retrieved from DB (`backend/.venv/Scripts/python.exe manage.py shell`) on **2026-09-01**.

```
slug:              ATBU
name:              Abubakar Tafawa Balewa University
status:            active
plan:              standard
domain:            None (not set)
storage_quota_bytes: 10737418240 (10 GB default)
allowed_email_domains: [] (not set)
branding:          {} (not set)
```

Note: source of this record is `backend/apps/common/management/commands/seed_demo.py` (ATBU was the seeded demo tenant). Any additional tenant fields needed for the seed (domain, email domains, branding) are not currently set and can be backfilled in a later step.
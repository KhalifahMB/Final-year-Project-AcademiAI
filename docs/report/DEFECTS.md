# Verified Defect Register

Sixteen issues discovered while preparing this report. Each was reproduced against the
running system at the revision documented in
[EVIDENCE.md §1](EVIDENCE.md#1-repository-state); none is inferred from reading code
alone. Each entry records the reproduction, the cause, and the recommended fix.

Severity is judged by user-visible impact:

- **High** — a documented feature is unusable, or the API documentation surface is broken.
- **Medium** — a feature is partially broken, or a scaling characteristic will not hold.
- **Low** — cosmetic, dead code, or documentation drift.

| Severity | Count | IDs |
|---|---|---|
| High | 4 | D1, D2, D3, D6 |
| Medium | 7 | D4, D5, D8, D10, D11, D15, D16 |
| Low | 5 | D7, D9, D12, D13, D14 |

**Resolution summary (harden pass over the audited revision).** Every defect except D11 has
now been fixed or verified already-fixed; each entry carries a `Status` line recording how.
The registers below reflect the repository as fixed; the reproduction text in each entry is
left intact so the *original* failure remains auditable. D6 was verified to have been fixed
by the frontend refactor that post-dates the audit snapshot, not by this pass.

---

## D1 — Plan tasks cannot be created through the API (High)

**Status: fixed in this pass.**

**Reproduction**

```
POST /api/v1/plan-tasks/
IntegrityError: null value in column "milestone_id" violates not-null constraint
```

**Cause.** `PlanTaskSerializer` in `backend/apps/learning/serializers.py` does not declare
`milestone` as a writable field. The model `PlanTask.milestone` is a non-nullable
`ForeignKey`, so any client request that does not supply it fails at the database level
rather than returning a 400 validation error. A study planner whose tasks cannot be
created over HTTP is not a usable planner.

**Fix.** Add `milestone` to the serializer's writable fields and set
`read_only=True` on the derived fields (`title_snapshot`, `due_date`,
`completed_at`). Until then, tasks can only be created by a client that bypasses the API.

**Resolution.** `PlanTaskSerializer` in `backend/apps/learning/serializers.py` declares
`milestone` as a writable `PrimaryKeyRelatedField`, exposes the derived
`milestone_title`, and scopes the choice queryset to the caller's own plan
(`plan__tenant=<own tenant>, plan__user=<own user>`) with an ownership check in
`validate_milestone`. Regression test:
`backend/apps/learning/test_plan_tasks.py::test_user_can_create_task_on_own_milestone_only`
(201 on an own plan milestone, 400 for another user's milestone).

**Workaround used for this report.** Tasks were inserted through the Django ORM inside a
`tenant_scope()` so that the planner screenshots in Chapter 5 show real content.

---

## D2 — The OpenAPI schema endpoint returns HTTP 500 (High)

**Status: fixed in this pass.**

**Reproduction**

```
GET /api/schema/ -> 500
TypeError: 'Meta.fields' must not contain non-model field names: session
```

`/api/schema/swagger-ui/` and `/api/schema/redoc/` return 200, but only because they serve
a static HTML shell; both fetch the schema over XHR and therefore render an error in the
browser. The entire interactive API documentation surface is non-functional.

**Cause.** `backend/apps/chat/views.py:112-113`:

```python
class ChatMessageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ChatSession.objects.none()
    filterset_fields = ["session"]
```

The declared `queryset` is a placeholder pointing at `ChatSession`, while
`get_queryset()` builds the real `ChatMessage` queryset at runtime. `django-filter`
validates `filterset_fields` against the **declared** queryset during schema generation,
and `ChatSession` has no `session` field. Runtime requests are unaffected, because
`get_queryset()` overrides the placeholder — which is why
`GET /api/v1/chat/messages/?session=<uuid>` correctly returns 401 when unauthenticated
rather than crashing.

**Consequence.** The checked-in `backend/AcademiAI API.yaml` (144 operations, 64 paths)
was stale and could not be regenerated while this defect stood. It has been regenerated.

**Resolution.** `backend/apps/chat/views.py` now imports `ChatMessage` at module scope and
declares `queryset = ChatMessage.objects.none()`, matching the `session` filter alongside
the runtime `get_queryset()` (the declared queryset is still a placeholder never used at
runtime). Schema generation and the `session` filter now agree, and
`manage.py spectacular --validate` completes successfully against the regenerated
`backend/AcademiAI API.yaml`. (The validation run reports pre-existing schema-quality
warnings/errors unrelated to this defect — missing OpenAPI extensions on the cookie
auth and raw `APIView`s without serializers — none of which causes the endpoint to
fail.)

---

## D3 — `GET /api/v1/logs/?search=…` returns HTTP 500 (High)

**Status: fixed in this pass.**

**Reproduction**

```
GET /api/v1/logs/          -> 200 (10 181 bytes)
GET /api/v1/logs/?search=abc -> 500 (Django error page)
GET /api/v1/logs/analyze/    -> 200 (27 968 bytes)
```

**Cause.** `backend/apps/logs/views.py:6` imports only `Avg`:

```python
from django.db.models import Avg
```

but lines 77-79 build a search filter with `Q(...)`, which was never imported. The
`NameError` only fires when the optional `search` query parameter is present, so the
endpoint passes its own test suite and looks healthy until a user types in the search box.

**Fix.** `from django.db.models import Avg, Q`.

**Resolution.** Applied (`backend/apps/logs/views.py:6`). `GET /api/v1/logs/?search=…` no
longer raises `NameError`.

---

## D4 — Student dashboard has two dead links to `/planner` (Medium)

**Status: fixed in this pass.**

**Reproduction.** The two `<Link to="/planner">` instances on the student dashboard
rendered a 404 because no `/planner` route is registered; plans live at `/plans`. In the
audited snapshot they sat in `frontend/src/pages/dashboard/DashboardPage.helpers.jsx`;
the frontend refactor has since moved the dashboard composition to
`frontend/src/pages/dashboard/StudentDashboard.jsx` (the header link and the plan-row
cards), with the same dead target.

**Fix.** Change both targets to `/plans`.

**Resolution.** Both links in `frontend/src/pages/dashboard/StudentDashboard.jsx` now point
to `/plans`, the route registered by `frontend/src/routes/tenantRoutes.js`; no
`/planner` route navigation remains anywhere in the frontend.

---

## D5 — Command palette theme commands throw (Medium)

**Status: fixed in this pass.**

**Reproduction.** `frontend/src/components/CommandPalette.jsx:44` destructures
`{ theme, setTheme }` from `useTheme()`, but `useTheme()` returns only `{ dark, toggle }`.
The two theme-related palette commands therefore destructure `undefined` and throw when
invoked. (The audit said "two" commands; the palette also offered a `System` mode that
`useTheme()` does not implement.)

**Fix.** Use `{ dark, toggle }` and drive `aria-checked` from `dark`.

**Resolution.** `CommandPalette.jsx` now consumes the real `{ dark, toggle }` API. The
`Light` and `Dark` commands call `toggle()` guarded on the current state and set
`aria-checked` from `dark`; the unsupported `System` command (and its `Monitor` icon) was
removed because no third mode exists in `useTheme()`.

---

## D6 — Timetable upload wizard cannot reach step 2 (High)

**Status: verified already fixed by the frontend refactor (commit `499f0ab`, post-dating
this audit's snapshot); no code change in this pass.**

**Reproduction.** In the audited snapshot, `frontend/src/pages/admin/CalendarUploadPage.jsx`
rendered a three-step wizard whose only visible control in step 1 was a file input; the
`setStep(2)` call was unreachable from the UI, so the preview and confirm steps could never
be displayed.

This was found by direct browser automation: the captured "timetable upload" screen shows
step 1 with no enabled forward control.

**Fix.** Wire the file input's `change` handler to validate the upload and call
`setStep(2)`.

**Resolution — verified, not authored by this pass.** The current `CalendarUploadPage.jsx`
is byte-identical to `HEAD` (unchanged since the `massive refactor` commit) and
implements a working wizard: step 1 selects a file, a **Preview timetable** button loads
the parsed events via `calendarApi.previewSchedule`, and an **Import N events** button
commits them via `calendarApi.commitSchedule` (both methods exist in
`frontend/src/services/api.js`). The defect was real against the audited revision but has
been obsolete since the refactor.

---

## D7 — Progress meter renders 4% filled when progress is 0% (Low)

**Status: fixed in this pass.**

**Reproduction.** `frontend/src/pages/dashboard/DashboardPage.helpers.jsx:20` computes the
meter width with a floor of 4%, so an unstarted module displays a small filled sliver
instead of an empty track.

**Fix.** Clamp to 0 and rely on the track background to communicate emptiness.

**Resolution.** The meter (`DashboardPage.helpers.jsx`, shared by the student and lecturer
dashboards) now renders a truly empty track at 0% — the minimum-slice trick is kept only
for *nonzero* progress so a 1% value stays visible. `aria-valuenow` continues to report the
real clamped value.

---

## D8 — Two Celery task routes point at modules that do not exist (Medium)

**Status: fixed in this pass.**

**Reproduction.** `CELERY_TASK_ROUTES` in `backend/config/settings.py:360` contains 8 route
entries. Two of them name modules that are not present in the repository:

```python
"apps.knowledge.tasks.*": {"queue": "ingestion"},
"apps.chat.tasks.*":      {"queue": "ai"},
```

There is no `backend/apps/knowledge/tasks.py` and no `backend/apps/chat/tasks.py`. The 11
tasks that actually exist live in `apps/accounts/tasks.py` (6), `apps/assessments/tasks.py`
(1), `apps/platform/tasks.py` (2), `apps/resources/tasks.py` (1) and
`apps/resources/summary_tasks.py` (1).

**Why this is inert today.** Both `apps.knowledge` and `apps.chat` appear in the
`autodiscover_tasks()` list in `backend/config/celery.py`, so Celery scans for task
modules in them, finds none, and continues. A route pattern that matches no registered
task is never consulted, so nothing fails at runtime.

**Why it still matters.** The routes encode an architectural assumption that ingestion and
chat summarisation belong to the knowledge and chat apps. That assumption is false, and it
is exactly the kind of drift that produces a silently unroutable task later: if a task is
ever added as `apps.chat.tasks.summarise`, it will be routed to the `ai` queue, but if the
file is created as `apps.resources.summary_tasks` — where the identical task already
exists — the route will never match. Two of eight declared routes describe a module
structure that does not exist.

**Fix.** Delete the two dead entries, or move the real modules to match the routes. Note
that `resources.summary_tasks.*` is already routed to the `ai` queue correctly, so the
`apps.chat.tasks.*` entry is redundant as well as dead.

**Resolution.** Both dead entries were deleted from `CELERY_TASK_ROUTES` in
`backend/config/settings.py`. The remaining routes (`apps.resources.summary_tasks.*`,
plus the accounts/assessments/platform/resources task modules) were verified against the
task modules that actually exist in the repository.

---

## D9 — Redundant and conflicting Tailwind processing (Low)

**Status: fixed in this pass.**

**Reproduction.** Three Tailwind entry points coexist:

1. `frontend/tailwind.config.js` exists but is inert — `frontend/src/index.css` contains
   no `@config` directive, so Vite's Tailwind plugin never loads it.
2. `frontend/vite.config.js` registers `@tailwindcss/vite`.
3. `frontend/postcss.config.js` also registers `@tailwindcss/postcss`.

**Impact.** Correctness is unaffected (the CSS-first `@theme` block in `index.css` is what
actually drives the design tokens), but the config file misleads maintainers.
`docs/FRONTEND_STACK.md` compounds this by claiming no Tailwind config files exist.

**Fix.** Delete `postcss.config.js` and either wire `tailwind.config.js` in via `@config`
or delete it and update the documentation.

**Resolution.** `frontend/postcss.config.js` (the duplicate `@tailwindcss/postcss` entry)
was deleted. Tailwind is now processed through the single `@tailwindcss/vite` plugin in
`frontend/vite.config.js`; `npm run build` still emits the full stylesheet. The
`tailwind.config.js` file is intentionally retained as a shadcn-CLI/intellisense mapping
(it is inert to the build, as the CSS-first `@theme` block in `index.css` is the source of
truth), so the `docs/FRONTEND_STACK.md` note was corrected to describe it as such rather
than claim no config files exist.

---

## D10 — Platform API group returns un-unwrapped Axios responses (Medium)

**Status: fixed in this pass.**

**Reproduction.** The `platformApi` group's `stats`, `health`, `auditLogs` and
`tenantDetail` functions `return api.get(...)`, yielding the full Axios response, whereas
every other API group returns `response.data`. Callers must therefore handle two different
shapes. (In the audited snapshot the group lived in
`frontend/src/services/platformApi.js`; the service layer is now consolidated into
`frontend/src/services/api.js`, where the four functions still returned the raw response.)

**Impact.** Inconsistent contract across the service layer; any component written against
the common convention silently reads `undefined` for data fields.

**Fix.** Unwrap `.data` in these four functions.

**Resolution.** All four functions now `return api.get(...).then((r) => r.data)`, matching
the rest of the service layer. Their five call sites — `PlatformConsolePage`,
`AnalyticsPage`, `SystemHealthPage`, `TenantDetailPage` and `AuditLogPage` — were updated to
consume the unwrapped data instead of reaching into `.data` a second time. (The remaining
`platformApi` sub-groups return their resources deliberately and are unwrapped by their
callers; they were out of scope for this defect.)

---

## D11 — Platform and audit apps have no test coverage (Medium)

**Status: still open.** Not addressed by this hardening pass; the fixes above were scoped to
defects with a confirmed user-visible failure or broken contract.

**Reproduction.** `apps/platform/` contains no test module. `apps/audit/tests.py` is an
empty stub. Both apps therefore contribute zero of the 280 collected tests while
exposing tenant-management and audit-trail endpoints.

**Fix.** Add tests covering tenant provisioning, domain approval, audit log write/read and
actor attribution.

---

## D12 — `seed_demo` is not idempotent across tenants (Low)

**Status: fixed in this pass.**

**Reproduction.** Re-running `manage.py seed_demo` against a database that already holds
the demo tenant fails with `duplicate key value violates unique constraint
"users_email_key"`.

**Cause.** The guard in the seeding routine checks
`User.objects.filter(email=email, tenant=tenant).exists()`, which is tenant-scoped, but
`users.email` carries a global unique constraint (`users_email_key`) on top of the
per-tenant one (`uniq_user_email_per_tenant`). An address already present in a
*different* tenant passes the guard and then collides — `admin@demo.local` exists under
the `demo-uni` tenant, so seeding `ATBU` reproduced it exactly.

**Resolution.** The guard now does both checks, in the right order. It reports
`Admin user already exists` for the same-tenant case, and for a cross-tenant clash it
prints a warning naming the constraint instead of raising. The global check deliberately
runs *outside* `tenant_scope()`, because a tenant binding would hide the foreign row and
the guard would pass again. The command also binds the tenant itself when it does create
the user.

---

## D13 — `DATABASE_URL` in `.env.example` is not read by any settings module (Low)

**Status: fixed in this pass.**

**Reproduction.** `.env.example` documents `DATABASE_URL`, but `backend/config/settings.py`
never reads it; it uses discrete `POSTGRES_*` variables.

**Impact.** A deployer who sets only `DATABASE_URL` gets the default database, silently.
The two backends disagree, and `DATABASE_HOST=localhost` in the example would point a
container deployment at itself.

**Fix.** Either honour `DATABASE_URL` in settings or remove it from `.env.example`.

**Resolution.** `backend/config/settings.py` now parses `DATABASE_URL` with a stdlib
`_postgres_conn_from_url()` helper (`postgres`/`postgresql` schemes) into the discrete
connection dict, and each `POSTGRES_*` environment variable still takes precedence over its
URL-derived equivalent. `.env.example` was updated to state the precedence explicitly.

---

## D14 — Tracked 10.5 MB binary inside the repository (Low)

**Reproduction.** `docs/AcademiAI Report.docx` is 10,967,924 bytes, is tracked by git, and
is simultaneously listed in `.gitignore` as non-source. Tracked files are not affected by
`.gitignore`, so the ignore rule is inert.

**Fix.** `git rm --cached "docs/AcademiAI Report.docx"` and delete the working-tree copy.
**Still outstanding — see §Cleanup status below.**

---

## D15 — Three failing backend tests (Medium)

**Status: fixed in this pass.**

Reproduced in isolation, identical to the full-suite run. Details in
[EVIDENCE.md §4.1](EVIDENCE.md#41-backend).

| Test | Failure |
|---|---|
| `test_student_reminders_only_due_exams_and_milestones` | Reminders return the plan milestone `Finish review` but omit the in-horizon exam `CS101 Finals` |
| `test_preview_text_and_pdf` | A `text/plain` resource reports `kind == "office"` |
| `test_preview_office_format_serves_extracted_text` | Response has no `preview_url` key |

The first two suggest the preview-classification and reminder-aggregation logic
disagrees with the behaviour its tests specify. The third suggests the response contract
changed without the test being updated. All three should be resolved before the reminder
and preview features are described to users as complete.

**Resolution.** The two preview tests were stale: they asserted the pre-refactor response
shape, but the shipped preview contract now serves text inline, delegates PDF/office
preview to a same-origin `content_path` (`/resources/<id>/content/`), and falls back to
extracted chunk text for other binaries. In
`backend/apps/common/tests/test_material_experience.py` the tests were brought back in line
with that contract — `test_preview_text_and_pdf` (now patching the storage client and
asserting the `pdf` kind / `content_path` / MIME), the renamed
`test_preview_office_format_delegates_to_client_renderer`, and a new
`test_preview_non_renderable_binary_serves_extracted_chunk_text` covering the chunk-text
fallback. `test_student_reminders_only_due_exams_and_milestones` passes against the
current aggregation logic. All four tests now pass together.

---

## D16 — Retrieval runs sequentially with no vector or full-text index (Medium)

**Status: fixed in this pass.** The heading is left unchanged so existing references to
it keep resolving; the reproduction below records what was found.

Found during the final verification pass, while auditing the claims in
[Chapter 4 §4.7.3](CHAPTER_4_ANALYSIS_AND_DESIGN.md#473-indexing-strategy) against the live
database. It is recorded here because the chapter previously asserted the opposite.

**Reproduction.** Query `pg_indexes` in the running database:

```sql
SELECT count(*) FROM pg_indexes
 WHERE schemaname = 'public'
   AND (indexdef ILIKE '%hnsw%' OR indexdef ILIKE '%ivfflat%');
-- 0

SELECT count(*) FROM pg_indexes
 WHERE schemaname = 'public'
   AND (indexdef ILIKE '%gin%' OR indexdef ILIKE '%gist%');
-- 0
```

The five indexes on `resource_chunks` are all `btree`:

| Index | Columns |
|---|---|
| `resource_chunks_pkey` | `id` |
| `uniq_chunk_index` | `resource_version_id, chunk_index` |
| `resource_chunks_tenant_id_cae46deb` | `tenant_id` |
| `resource_chunks_resource_version_id_5c34348d` | `resource_version_id` |
| `resource_ch_tenant__7ae677_idx` | `tenant_id, resource_version_id` |

**Consequence.** Two of the three retrieval signals are exact sequential scans:

- `apps/knowledge/retrieval.py:246` — `.order_by(CosineDistance("embedding", emb))`. With
  no ANN index, pgvector computes the distance for every authorised chunk on every query.
  `embedding` is declared `VectorField` with `db_index=False`.
- `apps/knowledge/retrieval.py:225` — `SearchVector("content", config="english")` is
  constructed inside the `SELECT`, so PostgreSQL parses and ranks the full text of every
  authorised chunk per query. There is no stored `tsvector` column and no `GIN` index.

**Severity: Medium, and rising with corpus size.** Correctness is unaffected — the results
are identical, just slower. At the measured 706-chunk corpus the cost is invisible, which is
precisely why it survived: nothing in the system fails. The cost is O(authorised chunks) per
query, so a tenant with 100 000 chunks pays 140× more than the tenant tested here, and the
RLS policy means the scan cannot be reduced by an index that is not tenant-prefixed.

**Resolution — applied in this pass.** Three changes, in two migrations plus one query
edit:

1. `resources` migration `0009` adds a persisted generated column
   `ts_vector = to_tsvector('english'::regconfig, content)` and a `GIN` index on it.
2. `resources` migration `0010` creates the approximate-nearest-neighbour index as raw
   SQL, because Django cannot express `hnsw` through `Meta.indexes`:
   `CREATE INDEX ... ON resource_chunks USING hnsw (embedding vector_cosine_ops)
   WHERE (embedding IS NOT NULL)`. The partial predicate mirrors the
   `exclude(embedding=None)` filter in the retrieval query.
3. `apps/knowledge/retrieval.py` now ranks against the stored column
   (`SearchRank(F("ts_vector"), …)`) and filters on `ts_vector @@ search_q`, so the
   planner has an index-usable predicate instead of `to_tsvector(…)` built inside the
   `SELECT`.

Post-migration counts moved from `0 → 1` for both approximate-NN and `GIN` indexes, and
the total in `public` from 317 to 319. `EXPLAIN` with the RLS policy lifted selects
`Index Scan using resource_chunks_embedding_hnsw` for the distance ordering and
`Bitmap Index Scan on resource_chunks_ts_vector_gin` (`Index Cond: ts_vector @@ …`, 182
rows) for the lexical leg. Both are re-verified in
[EVIDENCE §3.1](EVIDENCE.md#31-index-inventory).

**Residual — subsequently fixed.** The paragraph below recorded a remaining planner
limitation: the RLS policy predicate was being emitted as
`(tenant_id)::text = current_setting(…)`, which forced both a cast of the indexed
`tenant_id` column (making the tenant index unusable) and a filter rather than an index
condition. That residual has since been fixed in its own commit (`fix(rls): compare
tenant_id as uuid so column indexes are usable`):

- The policy expression in `backend/apps/common/rls.py` and
  `backend/apps/common/sql/rls_policies.sql` is now
  `tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` — the
  UUID cast is applied to the *setting* string, never to the column, so the existing
  `tenant_id` btree index is usable. The `NULLIF(…, '')` guard denies both the unset
  (`NULL`) state and PostgreSQL's `''`-after-`RESET` placeholder, which would otherwise
  raise `invalid input syntax for type uuid: ""`.
- Re-applied via `manage.py migrate` (RLS re-enforced on 45 tenant-scoped tables).
  `EXPLAIN` with `enable_seqscan=off` under the RLS policy now selects
  `Index Scan using resource_chunks_tenant_id_cae46deb` with `Index Cond: (tenant_id = …::uuid)`
  instead of a sequential scan. The RLS test suite passes in isolation.

The historical note that follows is retained for context.

**What was not changed at the time.** With the row-level security policy active, the planner
picked a sequential scan over the 706-row table: the policy predicate was emitted as
`(tenant_id)::text = current_setting(…)` and evaluated as a filter rather than an index
condition. That was a planner consequence of the then-existing RLS expression, not of these
indexes, and it did not affect correctness. It is documented in
[EVIDENCE §3.1](EVIDENCE.md#31-index-inventory), and was out of scope for the pass in which
this defect was first closed.

---

## Cleanup status

The approved documentation cleanup for this pass executed these deletions:

| Target | Result |
|---|---|
| `docs/archive/` | deleted |
| `docs/old/` | deleted |
| `docs/docs/` | deleted |
| `docs/AcademiAI Report.docx` (10.5 MB) | deleted — resolves **D14** |
| `docs/IMPLEMENTATION_PLAN.md` | deleted |
| `docs/IMPROVEMENTS.md` | deleted |
| `docs/AUDIT.md` | deleted |
| `docs/UX_REVIEW.md` | deleted |

**D14 status: fixed** — the file is removed from the working tree and `git rm --cached` was
used so it leaves the index on the next commit.

The same pass also applied two code fixes that are recorded above rather than here:

| Defect | Change |
|---|---|
| **D16** | `resources` migrations `0009` (generated `ts_vector` + `GIN`) and `0010` (raw-SQL `hnsw`), plus the lexical query rewrite in `apps/knowledge/retrieval.py` |
| **D12** | Two-step guard in `apps/common/management/commands/seed_demo.py` |

Re-seeding also required opening `tenant_scope()` in `seed_atbu` and
`seed_atbu_lecturers`: both write RLS-protected tables, and a management command has no
request middleware to bind the tenant for it, so both had been failing with `new row
violates row-level security policy`. `seed_atbu` now prints `faculties: 8, departments: 43,
programmes: 57`, which is what [EVIDENCE §6](EVIDENCE.md#6-seed-data-used-for-verification)
records.

---

## Hardening pass (this revision)

A second, dedicated hardening pass followed the cleanup pass and closed every defect above
except D11. It was performed against the repository at the audited revision and split into
logical commits (RLS cast isolated in its own commit, gated by the RLS test suite):

| Defect | Change |
|---|---|
| **D1** | `PlanTaskSerializer` writable scoped `milestone` + ownership validation; regression test |
| **D2** | `ChatMessageViewSet` declares a `ChatMessage` queryset; `AcademiAI API.yaml` regenerated |
| **D3** | `from django.db.models import Avg, Q` in `apps/logs/views.py` |
| **D4** | Student-dashboard links repointed from `/planner` to `/plans` |
| **D5** | `CommandPalette` uses `{ dark, toggle }`; unsupported `System` mode removed |
| **D6** | verified already fixed by the post-audit frontend refactor (no change) |
| **D7** | progress meter renders an empty track at 0% |
| **D8** | dead `knowledge`/`chat` Celery routes removed from `CELERY_TASK_ROUTES` |
| **D9** | duplicate `postcss.config.js` Tailwind entry deleted |
| **D10** | `platformApi` `stats`/`health`/`auditLogs`/`tenantDetail` unwrap `.data`; five callers updated |
| **D13** | settings honours `DATABASE_URL` (with `POSTGRES_*` precedence) |
| **D15** | stale preview tests realigned to the shipped contract; four tests pass together |
| **D16 (residual)** | RLS predicate compares `tenant_id` as UUID via `NULLIF(current_setting(...), '')::uuid`; index usable |
| **D14** | tracking removed and working-tree copy deleted |

A CI workflow (`.github/workflows/ci.yml`) was also added: it boots the compose
infrastructure (with `ACADEMIAI_DEV_TEST_ROLE=1` so the test role exists), runs the backend
`pytest` suite, and runs the frontend `oxlint`/`vite build`/`vitest` gates.

---

## Summary

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| D1 | High | learning | `POST /plan-tasks/` 500 — `milestone` not writable | fixed |
| D2 | High | chat | `GET /api/schema/` 500 — placeholder queryset vs `filterset_fields` | fixed |
| D3 | High | logs | `?search=` 500 — `Q` never imported | fixed |
| D6 | High | frontend | Timetable wizard cannot advance past step 1 | verified fixed (post-audit refactor) |
| D4 | Medium | frontend | Dead `/planner` links on student dashboard | fixed |
| D5 | Medium | frontend | Command palette theme commands throw | fixed |
| D8 | Medium | celery | Two task routes reference missing modules | fixed |
| D10 | Medium | frontend | Platform API group returns un-unwrapped responses | fixed |
| D11 | Medium | tests | No coverage for `platform` and `audit` apps | **open** |
| D15 | Medium | tests | Three pre-existing test failures | fixed |
| D16 | Medium | retrieval | No ANN or GIN index; retrieval is a sequential scan | fixed (incl. RLS-cast residual) |
| D7 | Low | frontend | Progress meter floor shows 4% at 0% | fixed |
| D9 | Low | frontend | Redundant/conflicting Tailwind config | fixed |
| D12 | Low | tooling | `seed_demo` not idempotent across tenants | fixed |
| D13 | Low | config | `DATABASE_URL` documented but unused | fixed |
| D14 | Low | repo | 10.5 MB tracked `.docx` | fixed |

**Open items: D11 only** (test coverage for the `platform` and `audit` apps).

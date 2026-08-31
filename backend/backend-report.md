# AcademiAI — Backend Endpoint & Logic Report

Compiled from the actual source: `config/urls.py`, each app's `urls.py`, `views.py`, `permissions.py`, `viewsets.py`, `db.py`, `dashboard.py`, and `stats.py`. All information below is grounded in the current code; nothing is guessed.

- Base URL: `http://localhost:8000/api/v1/` (auth endpoints under `/api/v1/auth/`)
- Branch/commit: `feat/frontend-redesign` @ `28c086e` (feature work since then is uncommitted)
- Router convention: DRF `DefaultRouter` registers list/by-accepted-verb routes (trailing slash, e.g. `/courses/`). Non-router endpoints are explicitly `path()`/`re_path()`.

---

## 1. Permission & Routing Helpers

### 1.1 Permission classes (`apps/common/permissions.py`)

| Helper | Grants access to |
|---|---|
| `IsTenantMember` | Any authenticated user belonging to the current tenant (student/lecturer/admin). |
| `IsAdminRole` | Tenant admin only (`role='tenant_admin'`). |
| `IsAdminRoleOrSuperuser` | Tenant admin **or** platform superuser (`is_superuser=True`). |
| `IsSuperuser` | Platform superuser only. |
| `IsLecturerOrAdmin` | Lecturer or tenant admin (denies pure students). |
| `IsStudentOrAbove` | Student, lecturer, or admin (every authenticated tenant member). |
| `IsOwnerOrAdminForWrite` | (resources) Owner OR admin on write; all authenticated tenant members can create. |

### 1.2 Base viewsets (`apps/common/viewsets.py`)

| ViewSet | Read access | Write access |
|---|---|---|
| `TenantModelViewSet` | All logged-in tenant members (`IsTenantMember`) | Admin only (`IsAdminRole`) |
| `AdminWriteViewSet` | All logged-in tenant members | Admin only |

Both scope querysets to `request.user.tenant`.

---

## 2. Account & Auth endpoints (`apps/accounts`) — mounted at `/api/v1/auth/`

Note the `accounts/urls.py` deliberately uses **JWT view names** for SimpleJWT and returns **SimpleJWT tokens** (the `SimpleJWTTokenObtainPairSerializer` is configured as the default serializer), even though several route names still read `token_obtain_pair` / `token_refresh`.

| Endpoint | Method(s) | Description | Permissions (role access) | Current status | Recommended action |
|---|---|---|---|---|---|
| `auth/signup/` | POST | Create a user, optional tenant slug, optional programme; issues a one-time 6-digit email verification code. RLS-scoped writes. | `AllowAny` (authenticator: none) | Working | None |
| `auth/verify-email/` | POST | Validate the emailed code; set `is_email_verified=True`; enqueue welcome email on first verification; throttle on attempts (max `AUTH_MAX_VERIFICATION_ATTEMPTS` per code). | `AllowAny` | Working | None |
| `auth/resend-verification/` | POST | Issue + email a new code (case-insensitive lookup, ~60 s throttle, always returns 200 to avoid account existence leak). | `AllowAny` | Working | None |
| `auth/login/` | POST | Exchange credentials for SimpleJWT access/refresh tokens. | `AllowAny` (JWT pair serializer) | Working | Rename view to `SimpleJWTTokenObtainPairView` / drop obsolete docstring vs. implementation |
| `auth/logout/` | POST | Blacklist the refresh token & rotate. | Authenticated (any member) | Working | None |
| `auth/logout-all/` | POST | Blacklist all refresh tokens for the session's user. | Authenticated (any member) | Working | None |
| `auth/token/refresh/` | POST | Refresh a short-lived access token. | Refresh-token-authenticated | Working | None |
| `auth/me/` | GET | Return current user profile + permissions summary. | Authenticated | Working | None |
| `auth/me/avatar/` | POST | Set avatar (`preset` and/or `data`-url). | Authenticated | Working | None |
| `auth/me/avatar` | PUT | Update avatar. | Authenticated | Working | Duplicate-ish route; align with a single verb if desired |
| `auth/password/change/` | POST | Change own password. | Authenticated | Working | None |
| `auth/password/reset/request/` | POST | Send reset email if account exists (no existence leak). | `AllowAny` | Working | None |
| `auth/password/reset/confirm/` | POST | Apply new password using the emailed token. | `AllowAny` | Working | None |
| `auth/users/` | GET | Admin list view of users. | Tenant admin / superuser (`IsAdminRoleOrSuperuser`) | Working | None |
| `auth/users/<uuid>/` | GET/PATCH/DELETE | Admin manage a specific user (PATCH supports role/status updates). | Tenant admin / superuser | Working | None |

### Related services (`accounts/services.py`)
- `signup_user` has already been cleaned of auto-enrollment: it creates the `User` + `StudentProfile`/`LecturerProfile` only.
- `resend_verification_code` / `confirm_password_reset` intentionally avoid leaking whether an account exists.

---

## 3. Tenant endpoints (`apps/tenants`)

### 3.1 `tenants/urls.py` — mounted at `/api/v1/`

| Endpoint | Method(s) | Description | Permissions | Status | Recommended action |
|---|---|---|---|---|---|
| `tenants/tenant-directory/` | GET | Public list of **active** tenants (slug, name, logo, etc.) — used by the signup flow. | `AllowAny` (no auth) | Working | None |
| `tenants/` | GET/POST | List your own tenant / create a tenant (POST used by signup-as-tenant-admin). | List: admin/superuser; Create: `AllowAny` | Working | None |
| `tenants/<uuid>/` | GET/PATCH/DELETE | Tenant detail / update / delete. | GET: tenant admin or superuser; PATCH: admin/superuser; DELETE: admin | Working | None |
| `tenant-requests/` | GET/POST | GET: list join/signup requests (superuser); POST: create a new tenant request (used by public onboarding). | GET: superuser; POST: `AllowAny` (anonymous) | Working | Add rate-limit / simple anti-abuse (see Issues #8) |
| `tenant-requests/<uuid>/review/` | POST | Superuser approves/rejects a tenant request. | `IsSuperuser` | Working | None |

### 3.2 `tenants/stats.py` — platform stats

| Endpoint | Method(s) | Description | Permissions | Status | Recommended action |
|---|---|---|---|---|---|
| `platform/stats/` | GET | Platform-wide aggregate stats (tenants, users, courses, offerings, enrollments, resources, etc.). | `IsSuperuser` | **Buggy** — see Issues #1 (enrollment count silently 0) | Fix `CourseEnrollment` lookup in `stats.py` |

---

## 4. Academics endpoints (`apps/academics`) — mounted at `/api/v1/`

All below extend `TenantModelViewSet` unless noted: **read = all tenant members, write = admin only**.

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `faculties/` | CRUD faculties | R: members / W: admin | Working | None |
| `departments/` | CRUD departments | R: members / W: admin | Working | None |
| `programmes/` | CRUD programmes | R: members / W: admin | Working | None |
| `academic-sessions/` | CRUD sessions | R: members / W: admin | Working | None |
| `semesters/` | CRUD semesters | R: members / W: admin | Working | None |
| `courses/` | CRUD courses | R: members / W: admin | Working | None |
| `course-offerings/` | CRUD course offerings | R: members / W: admin | Working | None |
| `lecturer-assignments/` | CRUD lecturer↔offering assignments | R: members / W: admin | Working; filters include `course_offering__course` | None |
| `course-enrollments/` | Enrollment CRUD | **Admin/superuser** (`IsAdminRoleOrSuperuser` on all default verbs) | Working | None |
| `course-enrollments/mine/` | List caller's own enrollments (role-agnostic) | Any authenticated member | Working (new, verified) | None |
| `course-enrollments/enroll/` | Student self-enroll (idempotent, same-tenant active offering) | `IsStudentOrAbove` restricted to students in logic | Working (new) | Consider an explicit student-only permission class instead of role check inside the view |
| `course-enrollments/unenroll/` | Student self-unenroll | Student-only (logic) | Working (new) | See above |
| `curriculum/` | Programme↔course linking | R: members / W: admin | Working | None |
| `programme-directory/` | Lookup programmes by tenant slug (used at signup) | Public (used pre-auth) | Working | None |

### Note
`course-enrollments/mine/` separation was introduced to fix the earlier "admin sees all tenant enrollments from a shared list endpoint" ambiguity (diagnosed as two distinct students on the same CS511 offering, not duplicate logic).

---

## 5. Resources endpoints (`apps/resources`) — mounted at `/api/v1/`

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `resources/` | List/create resources; visibility-aware queryset (private→owner, institution/course/programme/department/faculty scoping) | List: members (filtered by visibility); Create: all authenticated (~`IsOwnerOrAdminForWrite`) | Working | None |
| `resources/<uuid>/` | Retrieve/update/destroy | R: members w/ visibility; W: owner or admin | Working | None |
| `resources/<uuid>/upload/` | Presigned/finalize upload (block storage) | Owner/admin (write) | Working | None |
| `resources/<uuid>/summarize/` | Trigger AI summarization (checks `has_extractable_text`) | Owner/admin (write) | Working | None |
| `resource-versions/` | CRUD resource versions; non-owners can see only latest version | R: members; W: owner/admin | Working | None |
| `resource-summaries/` | CRUD summaries | R: members; W: owner/admin | Working | None |

Visibility enum: `private`, `course`, `programme`, `department`, `faculty`, `institution` (default `course`). `has_extractable_text` gates summarization.

---

## 6. Knowledge endpoints (`apps/knowledge`) — mounted at `/api/v1/`

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `concepts/` | CRUD knowledge concepts | R: members / W: admin | Working | None |
| `concept-edges/` | CRUD concept graph edges | R: members / W: admin | Working | None |

---

## 7. Assessments endpoints (`apps/assessments`) — mounted at `/api/v1/`

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `quizzes/` | CRUD quizzes; non-admin members only see `PUBLISHED` items | R: members (filtered) / W: admin | Working | None |
| `quizzes/<uuid>/submit/` (+ question/attempt helpers) | Student submit an attempt | Student | Working | None |
| `quizzes/<uuid>/generate/` | AI-generate quiz | Admin/lecturer | Working | None |
| `quiz-questions/` | Nested questions | R: members / W: admin | Working | None |
| `quiz-attempts/` | Attempts CRUD/history | Members (own) / admin | Working | None |

Quiz `Status`: `draft`, `published`, `archived` (default `draft`).

---

## 8. Learning endpoints (`apps/learning`) — mounted at `/api/v1/`

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `notes/` | Student notes CRUD | Owner (scoped) | Working | None |
| `bookmarks/` | Bookmarks CRUD | Owner | Working | None |
| `progress/` | Learning progress tracking | Owner | Working | None |

---

## 9. Chat endpoints (`apps/chat`) — mounted at `/api/v1/`

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `chat/conversations/` | Conversation CRUD | Authenticated members | Working | None |
| `chat/messages/` | Message CRUD | Members | Working | None |
| `chat/messages/stream/` | SSE stream for assistant responses | Authenticated | Working | See Issues #7 (rate limiting) |
| `chat/...` token/stream helpers | AI token budget & streaming plumbing | Authenticated | Working | None |

`AiRateThrottle` is referenced as the token/rate throttle on streaming endpoints.

---

## 10. Audit endpoints (`apps/audit`) — mounted at `/api/v1/`

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `audit-logs/` | Read-only admin trail of user/tenant actions | admin/superuser | Working | None |

Written by `log_action(...)` from `apps/audit/services.py` (used in signup, verification, password reset, etc.).

---

## 11. Common / utility endpoints (`apps/common`) — mounted at `/api/v1/`

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `common/jobs/<job_id>/` | Poll status for async background job (upload/summarize/import) | Owner (job-scoped) | Working | None |
| dashboard aggregates | Student / Admin / Lecturer aggregate dashboards (Redis-cached) | Role-specific | Working | None |

---

## 12. Platform endpoints (`apps/platform`) — mounted at `/api/v1/`

| Endpoint | Description | Role access | Status | Recommended action |
|---|---|---|---|---|
| `announcements/` | Platform announcements | Members (read) / admin (write) | Working | None |
| subscription endpoints | Plan/subscription status & management | Tenant admin | Working | None |

---

## Issues & Recommended Fixes

| # | Issue | Current code / file | Recommended fix |
|---|---|---|---|
| 1 | **Platform enrollment count silently returns 0.** `stats.py` filters `CourseEnrollment` using a nonexistent related name (`offering__tenant`) — the real FK is `course_offering` (`related_name="enrollments"`). It's wrapped in `try/except`, so it does **not** error; it just reports 0 enrollments in platform stats. | `apps/tenants/stats.py` (~line 294) | Change to `CourseEnrollment.objects.filter(course_offering__tenant=tenant).count()`; add a regression test asserting the count equals real enrollments. |
| 2 | **Admin list read scope ambiguity (now mitigated).** Previously all tenant members saw the full tenant enrollment list via the shared endpoint, making it look like per-user duplicates. | `apps/academics/views.py` `CourseEnrollmentViewSet` (fixed) | Already fixed by separating admin list (`/course-enrollments/`, admin-only) from the caller's own list (`/course-enrollments/mine/`). Keep this separation; don't regress. |
| 3 | **`/course-enrollments/enroll` & `/unenroll` enforce "student-only" in view logic, not via a permission class.** | `apps/academics/views.py` | Add an explicit `IsStudent` permission class (or reuse a dedicated helper) so the role contract is enforced at the permission layer, not a trailing check. |
| 4 | **Non-admin GET leaks on admin-oriented default verbs** (where intended). `CourseEnrollment` and similar now restrict default verbs to admin; verify every other `TenantModelViewSet` that should be write-admin-and-read-members matches the intended contract (they generally do). | App viewsets | Audit docstring vs. `get_permissions()` for each viewset; align any that still read "all members" but should be admin-only. |
| 5 | **`auth/login/` view name still says `token_obtain_pair` while returning SimpleJWT tokens.** Cosmetic but misleading for API-graph tooling. | `apps/accounts/urls.py` / `views.py` | Rename view class to match the SimpleJWT implementation (e.g. `SimpleJWTTokenObtainPairView`); update ORM/debug references. |
| 6 | **`has_extractable_text` mismatch across DB columns vs. model default.** A migration added the field; ensure no drift between `Resource.has_extractable_text` default and the summarization task's behavior for pre-existing rows. | `apps/resources/widgets/tasks.py` + migrations | Backfill `has_extractable_text` for existing rows during deploy so summarization is not wrongly gated. |
| 7 | **Chat streaming relies on `AiRateThrottle` as a soft token budget; streaming is a long-lived SSE connection.** If the throttle is event-based rather than token-based it can be bypassed by chunking. | `apps/chat/views.py` | Confirm the throttle counts tokens (or enforce a server-side token cap) on the SSE stream, not just request count. |
| 8 | **`tenant-requests/` POST is anonymous with no rate limit / abuse control** (docstring implies protection but it is open). | `apps/tenants/request_views.py` | Add DRF throttling (e.g. anon throttle scope) and/or CAPTCHA on public request creation. |
| 9 | **RLS read gaps.** Queries outside `tenant_scope(...)` silently return zero rows for non-superuser reads (observable in feature work). This is intentional isolation but can mask bugs (see #1). | `apps/common/db.py` | When adding aggregate/statistic queries, always run them inside `tenant_scope` (or annotate) and unit-test them under RLS; never rely on `try/except` to swallow empty results. |
| 10 | **Missing filters on several list endpoints.** e.g. `lecturer-assignments` recently gained `course_offering__course`; other viewsets under-filter by semester/session/status. | App viewsets `.filterset_fields` | Backfill `filterset_fields` (and search/ordering) for `course-offerings`, `resources`, `quiz-attempts`, `progress`, etc. per client needs. |
| 11 | **`auth/users/<uuid>/` PATCH role/status transitions unvalidated** against the role schema (only `student`/`lecturer`/`admin` exist; superuser is admin + flags). | `apps/accounts/serializers.py` / `views.py` | Validate role changes and forbid demoting the last active admin; guard against invalid role strings. |

---

## Notes & Definitions (context)

- **Role schema** (`accounts/models.py User.Role`): only `student`, `lecturer`, `tenant_admin`. No `admin`/`superadmin` role value. Superusers are `role='tenant_admin'` + `is_superuser=True` + `is_staff=True`; tenant admin = `role='tenant_admin'` with `is_superuser=False`. `User.is_tenant_admin` is a convenience property (`role == tenant_admin`).
- **RLS (`apps/common/db.py`)**: `tenant_scope(tenant_id)` sets `app.current_tenant_id` transaction-locally. Reads outside scope return zero rows under RLS — keep this in mind when auditing counts.
- **Related name gotcha** (`apps/academics/models.py`): `CourseOffering` → `enrollments` (so the correct lookup is `course_offering__tenant`), and `Course` → `offerings`, `curricula`.
- **Enrollment serializer** exposes `student` as a UUID plus display fields (`student_email`, `student_name`, `offering_course_code/title`, `session_name`, `semester_name`) — clients never render raw offering UUIDs.
- **Resources visibility** enum: `private`/`course`/`programme`/`department`/`faculty`/`institution` (default `course`).
- **Quiz status** enum: `draft`/`published`/`archived` (default `draft`); non-admin members only see `published` quizzes.

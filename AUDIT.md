# AcademiAI — Security & Code Audit

Date: 2026-08-30
Scope: Full codebase (backend Django/DRF, frontend React/Vite, infrastructure/docker).
Status: Findings recorded below; fixes applied and tracked with a checkmark.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low / Info

---

## 🔴 Critical

### C1 — Runtime DB user is a PostgreSQL superuser → RLS silently bypassed
- **Files:** `docker-compose.yml:5-7`, `.env`, `infrastructure/postgres/init/01-app-role.sql`, `backend/config/settings.py:97-107`
- **Issue:** The backend/worker connect as `POSTGRES_USER=academiai`, a bootstrap **superuser** with `BYPASSRLS`. Superusers ignore row-level security even with `FORCE ROW LEVEL SECURITY`. The `academiai_app` (NOBYPASSRLS) role is created but **never used for runtime traffic**, so multi-tenant RLS protection is decorative.
- **Impact:** Any app-layer tenant-filtering bug leaks cross-tenant data with no DB backstop.
- **Fix (not applied — requires infra/ops change):** Connect as `academiai_app` with a strong password; migrate/re-own tables as that role; verify `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`.

---

## 🟠 High

### H1 — Real API keys in working-tree `.env`
- **Files:** `.env:53` (`GEMINI_API_KEY=AQ.Ab8RN6…`), `.env:60` (`COMPOSIO_API_KEY=ak_nu7WAQ…`)
- **Status:** ✅ Not committed (verified via git), but present on disk.
- **Action:** **[USER MUST ROTATE]** both keys at the provider dashboards; store in a secret manager; keep `.env` out of archives/shared folders.

### H2 — seed_demo superuser with hardcoded password
- **File:** `backend/apps/common/management/commands/seed_demo.py:20-28`
- **Issue:** Creates `admin@demo.local` / `DemoAdmin123!`, echoed to stdout.
- **Impact:** Guessable superuser+password for anyone reaching login; demo command is load-bearing.
- **Fix (not applied):** Restrict to `DEBUG=True` only; require password override from env.

### H3 — JWT access + refresh tokens in `localStorage` (XSS theft) — ✅ verified
- **Files:** `frontend/src/hooks/useAuth.jsx:19,71-72,78`, `frontend/src/services/api.js:15,28,34`
- **Status:** ⏳ **NOT fixed in this pass** — requires architectural change (in-memory access token + HttpOnly-cookie refresh token). Documented as an outstanding HIGH.
- **Residual risk:** localStorage remains XSS-readable.

### H4 — No CSP / security headers
- **File:** `frontend/index.html`
- **Issue:** No CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
- **Status:** ⏳ Pending — deploy via edge/nginx or static headers.

### H5 — RAG cache leaks private-resource content across users (same tenant) — ✅ verified & fixed
- **File:** `backend/apps/chat/views.py:410`
- **Issue:** Cache key `rag:{tenant_id}:{query_hash}` omits user id → user B receives user A's cached private chunks.
- **Fix:** Include `user.id` in the cache key.

### H6 — Quiz scoring counts unanswered questions as correct — ✅ verified & fixed
- **File:** `backend/apps/assessments/views.py:155-163`
- **Issue:** Question with `correct_answer={}` → `_norm(None)==_norm(None)` → `True`.
- **Fix:** `if user_ans is None: continue` (do not count as correct).

### H7 — Insecure hardcoded credential defaults operate in production
- **Files:** `backend/config/settings.py:97-107,246,286-287`
- **Issue:** DB, MinIO, RabbitMQ passwords fall back to known defaults with only `SECRET_KEY` guarded.
- **Fix:** Fail fast when `DEBUG=False` and any of these equal the known dev defaults.

### H8 — Infrastructure bound to `0.0.0.0` with trivial/weak creds
- **Files:** `docker-compose.yml` (all services), `.env`
- **Issue:** Postgres/Redis(no auth)/RabbitMQ/MinIO published to all interfaces; weak creds; Redis unauthenticated.
- **Fix (ops):** Bind to `127.0.0.1`, strong random creds, `--requirepass` for Redis.

### H9 — Django admin + Swagger/Redoc/OpenAPI exposed unconditionally
- **Files:** `backend/config/urls.py:14,27-37`
- **Issue:** `admin/`, `/api/schema/`, swagger-ui, redoc mounted regardless of `DEBUG`; schema views default `AllowAny`.
- **Fix:** Gate behind `DEBUG`/staff.

---

## 🟡 Medium

- **M1** — Signup leaks whether an email exists (enumeration) — `accounts/views.py:56-80`, `accounts/services.py:101` — ✅ fixed.
- **M2** — Changing email via `/auth/me/` doesn't reset `is_email_verified` — `accounts/serializers.py:42-68` — ✅ fixed.
- **M3** — `UserAdminViewSet` PATCH silently broken (all fields read-only) — `accounts/serializers.py:9-36`, `accounts/views.py:517` — ⏳.
- **M4** — `CustomTokenObtainPairSerializer` embeds raw email into JWT (latent) — `accounts/serializers.py:130-137` — 🔺 removed.
- **M5** — Public `/tenant-requests/` has no rate limit — `tenants/request_views.py:34` — ✅ fixed.
- **M6** — Platform stats (superuser) RLS-scoped counts silently wrong/0 — `tenants/stats.py` — ⏳.
- **M7** — Tenant-request provisioning creates superuser with hardcoded creds (related to H2) — ⏳.
- **M8** — PWA service worker caches sensitive API + signed-URL responses — `frontend/vite.config.js:48-74` — ⏳.
- **M9** — Weak frontend password policy (no min-length on change) — `frontend/src/lib/validations.js:51,62` — ✅ fixed.
- **M10** — Cross-tenant FK references not validated in serializers (CourseOffering, ConceptEdge, ProgressRecord) — ⏳.

---

## 🟢 Low / Info

- **L1** — `TenantDirectoryView` `int(limit)` → HTTP 500 on bad input — `tenants/views.py:34` — ✅ fixed.
- **L2** — Password-reset confirm email match case-sensitive — `accounts/services.py:213` — ✅ fixed.
- **L3** — `storage_key`/`checksum`/`created_by` exposed in resource serializers — `resources/serializers.py:13,52` — ✅ fixed.
- **L4** — Emails logged as PII — `accounts/views.py:111`, `accounts/services.py:188`, `accounts/tasks.py:137` — ✅ fixed.
- **L5** — JWT no `AUDIENCE`/`ISSUER` validation — `config/settings.py:181` — ✅ fixed.
- **L6** — Long token lifetimes (60m access / 7d refresh) — `config/settings.py` — ⏳ (configurable; left as-is).
- **L7** — Resource version/deletion only cleans current S3 object; historical versions orphan — `resources/views.py:280-288` — ⏳.
- **L8** — Ingestion task can overwrite newer `storage_key` on late execution — `resources/tasks.py:166` — ⏳.
- **L9** — `complete_upload` version-number race → IntegrityError — `resources/views.py:364` — ⏳.
- **L10** — Quiz submit lacks `select_for_update`/atomic (TOCTOU) — `assessments/views.py:136` — ⏳.
- **L11** — Dead `is_active` login branch; suspended users get generic "invalid credentials" — `accounts/views.py:213` — ⏳.
- **L12** — Backend runs as root in container; no resource limits — `backend/Dockerfile` — ⏳ (ops).
- **L13** — Frontend Dockerfile `npm install` (not `ci`), no `.dockerignore`, includes `node_modules` — ⏳ (ops).
- **L14** — Floating `latest` image tags (MinIO/mc); `radix-ui:latest` — ⏳ (ops).
- **L15** — `scripts/e2e_smoke.sh` hardcodes demo creds — ⏳ (dev-only; document).
- **L16** — **(CRASH)** `AdminQuizzesPage.jsx` uses `useMemo:225` but imports only `useState` — ✅ verified & fixed.
- **L17** — `formatRelativeTime` mislabels future times — `frontend/src/lib/utils.js:26` — ⏳.
- **L18** — RLS tables list omits `resource_concepts` — `common/rls.py:20-30` — ⏳.
- **L19** — AcademicSession no `is_current` mutual-exclusivity; Semester create path too — `academics/views.py` — ⏳.
- **L20** — Vite dev `host:0.0.0.0`+`allowedHosts:true`; `.gitignore` misses `.env.prod/.staging`; `.env.example` ships `DEBUG=True` — ⏳.

---

## Verified-clean (spot checks)
- No `dangerouslySetInnerHTML`; Markdown HTML escaped (no `rehype-raw`).
- `target="_blank"` links use `rel="noopener noreferrer"`.
- `.env` gitignored and never committed.
- CORS `ALLOW_CREDENTIALS=False`; JWT via Bearer (no cookie CSRF surface on API).
- JWT rotation + blacklist enabled.
- No leftover `role === 'admin'` UI checks.
- Backend `.dockerignore` excludes `.env`.

## Fix conventions
- All code fixes are minimal and preserve existing behavior/tests.
- Backend fixes verified with `manage.py check`, targeted pytest, `makemigrations --check`.
- Frontend fixes verified with `npm run lint`, `npm run build`.

---

## Fix log (applied 2026-08-30)

### Backend
- **H5** — `apps/chat/views.py`: RAG cache key now includes `user.id` → `rag:{tenant}:{user}:{hash}`. ✅
- **H6** — `apps/assessments/views.py`: `submit` skips unanswered questions (`if user_ans is None: continue`). ✅
- **H7** — `config/settings.py`: fail-fast raised on known default DB/MinIO/RabbitMQ credentials when `DEBUG=False`. ✅
- **M1** — `apps/accounts/views.py` + `services.py`: signup for an existing email now returns the same generic 201 (no enumeration); a silent `user.signup_attempt_existing` audit event is recorded. ✅
- **M2** — `apps/accounts/views.py` (`MeView.perform_update`): changing email sets `is_email_verified=False`, expires old codes, and queues a re-verification email. ✅
- **M4** — `apps/accounts/serializers.py`: removed the `email` PII claim from the latent `CustomTokenObtainPairSerializer` (role/tenant_id informational claims kept). ✅
- **M5** — `apps/tenants/request_views.py` + `config/settings.py`: public `/tenant-requests/` now throttled at `5/hour`. ✅
- **L1** — `apps/tenants/views.py`: `TenantDirectoryView` clamps non-numeric/`<1` `limit` to 100 instead of 500ing. ✅
- **L2** — `apps/accounts/services.py`: `confirm_password_reset` uses `email__iexact`. ✅
- **L3** — `apps/resources/serializers.py`: removed `storage_key` (ResourceSerializer) and `storage_key`/`checksum` (ResourceVersionSerializer) from read output. ✅
- **L4** — PII emails removed from logs in `accounts/views.py`, `accounts/services.py`, `accounts/tasks.py` (log user ids instead). ✅
- **L5** — `config/settings.py`: `SIMPLE_JWT` now sets `AUDIENCE` + `ISSUER`. ✅

### Frontend
- **L16** — `pages/AdminQuizzesPage.jsx`: added missing `useMemo` import (was a runtime crash). ✅
- **L18** — Deep UI/UX review + fixes applied — see `UX_REVIEW.md` for the full inventory (rated 6.5/10): live visual bugs (`bg-[var(--accent)]` class-splicing), fake study minutes, dead `AdminCrudPage` deleted, ops-jargon leaks, duplicate KPIs, password toggles, retry buttons, and copy/decor sweeps. ✅

### Not applied (require infra/arch/ops or are informational)
- C1 (RLS runtime role), H1 (rotate keys — user action), H2 (seed_demo), H3 (localStorage JWT), H4 (CSP/headers), H8 (bind infra to loopback), H9 (gate admin/schema), M3, M6, M7, M8, M10, L7-L15, L17-L20.

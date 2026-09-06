# AcademiAI — Backend Security & Correctness Audit

Deep review of the Django backend (all 12 apps + `config/`), conducted 2026-09-02.
Every finding below was cross-verified against the actual source. Agent-derived
findings that did not hold up under direct inspection were dropped or downgraded.

Status legend:
- ✅ FIXED — implemented
- 🛠 IN PROGRESS — fix being implemented
- ⬜ OPEN — not yet addressed

Severity: 🔴 HIGH, 🟠 MEDIUM, 🟡 LOW.

---

## 🔴 CRITICAL / HIGH

### H1 — Password reset is broken end-to-end (user-facing showstopper) ✅ FIXED
- **File:** `apps/accounts/tasks.py:47-65`
- **Issue:** `send_password_reset_email` accepts `token: str` but never includes it
  in the template context. `reset_url` is just `/password-reset` (no token), so the
  email the user receives contains no way to complete the reset. Reset literally
  cannot work.
- **Fix:** Build `reset_url` as `<frontend>/password-reset?token=<token>` and pass it
  (plus the raw token if the template needs it) into the context.

### H2 — Dashboard cache key has no user id → cross-user data leak ✅ FIXED
- **File:** `apps/common/dashboard.py:31-33`
- **Issue:** `_tenant_cache_key` = `dashboard:{tid}:{role}:{suffix}` — shared by all
  users of the same role + tenant — while `_build()` produces **user-specific** data.
  `StudentDashboardView.get()` caches under this key for 60s, so Student B in a tenant
  can receive Student A's personalized dashboard.
- **Fix:** Include `user.id` in the cache key for user-scoped dashboards.

### H3 — Tenant admins can read/version anyone's PRIVATE resources ✅ FIXED
- **File:** `apps/resources/views.py:578-589`
- **Issue:** `_parent_resource` swaps `_authorized_resources_q(...)` for `Q()` when the
  user is admin/superuser. But `_authorized_resources_q` deliberately restricts admins
  to `~Q(PRIVATE)` and private to owner-only. A tenant admin can therefore open the
  version history of (or add versions to, via `perform_create`) any user's private
  material — contradicting the code's own intent comments.
- **Fix:** Keep private-owner-only semantics in `_parent_resource` (do not blanket-bypass
  with `Q()`); only broaden visibility for admins to all *non-private* resources, while
  still excluding other users' private materials.

### H4 — Prompt injection into the agent's system prompt ✅ FIXED
- **File:** `apps/agent/agent_loop.py:39-44` / `apps/agent/views.py:46`
- **Issue:** `context_type` comes straight from `request.data` and is f-stringed into
  `system_instruction`; course titles/names are also injected unsanitized. `_sanitize_context`
  (`gemini.py:98-103`) exists for this but the agent path bypasses it.
- **Fix:** `build_agent_prompt` now sanitizes `context_type`, profile name/role, and the
  serialized course JSON via `_sanitize_context`; the view validates `context_type` against
  the allowed set and rejects anything else.

### H5 — Agent SSE stream has no exception guard → truncated/corrupt responses ✅ FIXED
- **File:** `apps/agent/views.py:63-103` + `apps/agent/agent_loop.py`
- **Issue:** `build_agent_prompt` runs before the inner try/except, and the consumption of
  `run_agent_turn` in the view is unwrapped. Any raise kills the `StreamingHttpResponse`
  with a raw 200 + partial stream; the client never gets a proper `error`/termination event.
- **Fix:** The stream generator is now wrapped in try/except that turns any exception into a
  terminating `error` SSE event instead of truncating the response.

### H6 — Quiz submit race → double scoring ✅ FIXED
- **File:** `apps/assessments/views.py:138-173`
- **Issue:** `submit` reads `submitted_at`, checks it, then writes `score`+`submitted_at`
  with no `select_for_update()`/transaction. Two concurrent POSTs both pass the guard; the
  last save wins. Score corruption / grade inflation.
- **Fix:** Scoring now runs inside `transaction.atomic()` and locks the attempt row with
  `select_for_update()` before re-checking `submitted_at`.

### H7 — Quiz question leak before publication ✅ FIXED
- **File:** `apps/assessments/views.py:82-97`
- **Issue:** `QuizQuestionViewSet` filters only by tenant, no quiz-status check. A student
  who knows a draft quiz's UUID can fetch all its questions.
- **Fix:** `QuizQuestionViewSet.get_queryset` now restricts students to questions of
  `PUBLISHED` quizzes only.

### H8 — Agent history is stateless + unbounded writes ✅ FIXED (partially)
- **File:** `apps/agent/views.py:57,76` + `apps/agent/tools.py:98-138`
- **Issue:** A new `AgentSession` is created every request despite a "create or reuse"
  comment, and `history` is never passed to `run_agent_turn`, so multi-turn context is
  dropped. `create_plan` writes unbounded milestones/tasks per iteration while only the HTTP
  request is throttled (1 request = up to 5 Gemini calls).
- **Fix:** The view now reuses the user's most recent session instead of creating a new one.
  `create_plan` caps milestones (10) and tasks per milestone (20) to bound DB writes. Full
  message-history threading is not yet implemented (lower value, follow-up).

---

## 🟠 MEDIUM

### Accounts
- **M1** Signup leaks email existence — `apps/accounts/views.py:82-93` returns `{user: null}`
  for duplicates vs a full object for new users (same 201). ✅ FIXED (both paths now return
  `{user: null}` — byte-identical response, no existence oracle)
- **M2** Lecturer self-registration — `apps/accounts/views.py:63-64` blocks only
  `tenant_admin`, so anyone can self-register as **lecturer** for an active tenant. ✅ FIXED
  (self-service signup now always coerces role to `student`; lecturer/admin via tenant admin only)
- **M3** Password reset/change doesn't invalidate existing JWTs — `apps/accounts/services.py:243`. ⬜ OPEN
- **M4** Logout swallows blacklist failure — `apps/accounts/views.py:257-264`
  (`except Exception: pass` + always `success:true`). ⬜ OPEN
- **M5** `UserAdminViewSet` PATCH is a silent no-op — `apps/accounts/serializers.py:46`
  makes every field read-only yet PATCH is allowed; role-change audit is dead code. ✅ FIXED
  (new `UserAdminUpdateSerializer` allowlist: first/last name, role, is_active, phone, gender,
  avatar_preset — PATCH works, role-change audit fires, privilege-critical fields excluded)
- **M6** Email-change re-verification non-atomic — `apps/accounts/views.py:295-304`. ⬜ OPEN

### Agent
- **M7** `context_type` never validated + `AgentToolExecution` never written — tool calls
  unlogged. 🛠 PARTIAL (context_type now validated via H4; tool-execution logging not yet wired)

### Resources
- **M8** `complete_upload` version-numbering race — `apps/resources/views.py:364-365`
  (no `select_for_update`). ✅ FIXED (version numbering now inside `transaction.atomic()` with
  `select_for_update()` row-lock on the resource)
- **M9** `complete_upload` accepts arbitrary client `content_type` — `apps/resources/views.py:368-370`. ✅ FIXED
  (declared content type validated against `_content_type_allowed` before storing)
- **M10** `process_resource_ingestion` retries permanent `FileValidationError` —
  `apps/resources/tasks.py:138-142,186-192`. ⬜ OPEN
- **M11** `application/octet-stream` bypasses MIME allowlist — `apps/resources/views.py:33-34`,
  `apps/common/security/file_validation.py:16-18`. ⬜ OPEN
- **M12** `summarize` task doesn't re-check visibility; writes `created_by=None` if user
  deleted — `apps/resources/summary_tasks.py:29-60`. ⬜ OPEN
- **M13** Student can create offering-less resource at any visibility scope —
  `apps/resources/serializers.py:28-30`. ⬜ OPEN

### Chat / Learning / Assessments / Knowledge
- **M14** Chat session-list N+1 — `apps/chat/serializers.py:72-76`, `apps/chat/views.py:72`. ⬜ OPEN
- **M15** `ProgressRecord` `concept`/`progress_value` writable on PATCH —
  `apps/learning/views.py:46-54`, `apps/learning/serializers.py:80-84`. ✅ FIXED
  (`progress_value` is now read-only — server-derived mastery cannot be forged; `concept`
  remains writable but is scoped to the user's own tenant-scoped records)
- **M16** RAG retrieval cache not invalidated on authz change — `apps/chat/views.py:428-439`. ⬜ OPEN
- **M17** `_viewer_academic_context` / retrieval enrollment+assignment lookups lack explicit
  tenant filter — `apps/knowledge/retrieval.py:85-92`. ⬜ OPEN
- **M18** `ConceptInteractionViewSet` filters by user only, no tenant —
  `apps/learning/views.py:108-109`. ⬜ OPEN
- **M19** `ResourceReadingPositionViewSet.perform_update` doesn't set tenant on update —
  `apps/learning/views.py:74-75`. ⬜ OPEN

### Common / Tenants / Logs
- **M20** AI greeting + insight leak tenant-wide (non-user-visible) resource counts —
  `apps/common/dashboard.py:926-928,1078-1081`. ✅ FIXED (now filtered by `_authorized_resources_q`)
- **M21** `AiInsightView` injects unvalidated `dashboard_type` into the Gemini prompt —
  `apps/common/dashboard.py:999`. ✅ FIXED (whitelisted to student/lecturer/admin)
- **M22** `tenant_logs` not in RLS `TABLES` list; `TenantLog.tenant_id` is a bare `UUIDField` —
  `apps/common/rls.py:20-30`, `apps/logs/models.py:25`. ✅ FIXED (`tenant_logs` added to RLS
  `TABLES`; generated `logs.0001_initial` migration (app was missing one) + new
  `common.0002_rls_tenant_logs` migration applies RLS; verified `relrowsecurity=True`,
  FORCE on, `tenant_isolation` policy active. Bare UUID is safe because RLS `WITH CHECK`
  now pins `tenant_id` to the session's `app.current_tenant_id`)
- **M23** `TenantLoggingMiddleware` reads/parses full `request.body` for every write —
  `apps/logs/middleware.py:81-86`. ⬜ OPEN
- **M24** `TenantContextMiddleware` decodes the JWT twice (TOCTOU + redundant work) —
  `apps/common/middleware.py:31-44`. ⬜ OPEN
- **M25** AI greeting/insight endpoints not `AiRateThrottle`-scoped — Gemini quota burnable. ⬜ OPEN

---

## 🟡 LOW (worth noting)
- `accounts/services.py:199-204` dead `else` after early return; race in `create_verification_code`.
- Conflicting uniqueness: `email unique=True` global vs `UniqueConstraint(tenant,email)` per-tenant.
- Dashboard `concept_mastery` uses `StopIteration` control flow + per-offering loops (O(n²));
  N+1 in `continue_courses`.
- Celery `generate_quiz_task` retry can duplicate quizzes (no idempotency on `generation_job_id`).
- `_extract_text` has no cap on extracted text size → worker OOM risk.
- `get_latest_summary` N+1 fallback — `resources/serializers.py:104`.
- ClamAV fails open when library/daemon unavailable; `<script` check only scans first 512 bytes
  for `.html/.htm/.svg`.
- `TenantRequestListView` / `TenantLogViewSet` count after slicing → inaccurate counts.
- Health check embeds default RabbitMQ creds — `common/views.py:136-138`.
- Several apps have empty test stubs (chat, assessments, audit, learning, knowledge).

---

## Fix plan (priority order)
1. ~~H2 — dashboard cache leak (highest security impact)~~ ✅
2. ~~H1 — password reset token (highest user impact)~~ ✅
3. ~~H3 — private-resource admin bypass~~ ✅
4. ~~H4 / H5 — agent prompt-injection + stream crash safety~~ ✅
5. ~~H6 / H7 — quiz scoring race + question leak~~ ✅
6. ~~M21 / M20 — AI prompt/data leakage~~ ✅
7. ~~H8 — agent session reuse + bounded writes~~ ✅ (session reuse + caps)
8. ~~M1/M2/M5/M8/M9/M15/M22 — accounts, resources, learning, logs RLS~~ ✅ (see below)

Each fix is verified with `manage.py check` (backend), `makemigrations --check --dry-run`,
and (where relevant) the affected test suites + live RLS verification before being marked ✅ FIXED.

### Fixed MEDIUM batch (this pass)
- ~~M1 / M2 — signup enumeration + lecturer self-registration~~ ✅
- ~~M5 — admin PATCH silent no-op (new writable allowlist serializer)~~ ✅
- ~~M8 / M9 — upload version race + MIME spoof~~ ✅
- ~~M15 — ProgressRecord progress_value forgery~~ ✅
- ~~M22 — RLS on tenant_logs (new logs migration + common.0002)~~ ✅

### Open follow-ups (MEDIUM/LOW not yet addressed)
- M3, M4, M6 accounts (token invalidation on reset, logout blacklist failure, non-atomic
  email re-verify)
- M10–M13 resources (retry churn, octet-stream bypass, summary authz, visibility on
  offering-less resources)
- M14, M16–M19 chat/learning/assessments/knowledge (N+1, RAG cache, missing academic tenant
  filters, ConceptInteraction tenant filter, ReadingPosition tenant-on-update)
- M23–M25 common/logs (body logging, double JWT parse, AI rate limit)

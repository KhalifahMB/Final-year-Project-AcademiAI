# Backend deployment checklist

Security, correctness, and deployment-readiness items for the Django tier.
Companion AI-specific checklist: `docs/DEPLOYMENT_AI_CHAT_AGENT.md`.

Legend: **Fixed** = already applied in this round *verified*; items without a status are open.

---

## 1. Already fixed (verified)

| Finding | Where | What changed |
|---------|-------|--------------|
| **H1 — `?quiz=` silently ignored on attempts** | `apps/assessments/views.py` | Added `filterset_fields = ["quiz", "student"]` to `QuizAttemptViewSet`. Without it the global `DjangoFilterBackend` ignored the param, so the quiz page's "Past attempts" pane showed attempts from *other* quizzes. Student rows are still re-scoped to the requester in `get_queryset`. |
| **H5 — agent `message_count` lost-update race** | `apps/agent/views.py:81-83` | Replaced `session.message_count += 1; save()` with an atomic `AgentSession.objects.filter(pk=…).update(message_count=F("message_count") + 1, …)`. Two concurrent streams can no longer overwrite each other. |
| **F1 — unbounded agent input (token/cost abuse)** | `apps/agent/views.py` | `message` now capped at 10,000 chars (mirrors `ChatMessageCreateSerializer`), rejected with a 400. |

> The first two bullets above are security/correctness *backend* equivalents of the frontend scan. Note: **quiz-question pagination** (`apps/common/pagination.py` caps at `page_size=20`, `max=100`) is intentionally left unchanged — the frontend already requests `page_size=100`; quizzes >100 questions still need a backend decision (see §6). Full-suite backend tests are slow/flaky on this machine (xdist worker crash, serial run >10 min); the changed apps (`agent`, `assessments`) pass 11/11.

---

## 2. Security hardening (open)

| # | Severity | Finding | Location | Action |
|---|----------|---------|----------|--------|
| M1 | Medium | **Agent avatars accept SVG + trust client Content-Type.** No magic-byte sniffing (user avatars in `accounts/services.py` sniff correctly). SVG lands on app origin → stored-XSS surface on direct navigation. | `apps/agent/views.py:222-272` | Drop `image/svg+xml` from `_ALLOWED_AVATAR_TYPES`, sniff magic bytes like `sniff_avatar_image`, and add a restrictive CSP on `/media/` responses. |
| L1 | Low | **ResourceSerializer only tenant-checks `course_offering`** — `programme`/`department`/`faculty` writable FKs accept foreign-tenant IDs (RLS doesn't catch it; scoping semantics break). | `apps/resources/serializers.py:28-33` | Validate each FK's `tenant_id == user.tenant_id`. |
| L2 | Low | **XFF spoofing in audit logs** — middleware trusts the first `X-Forwarded-For` value for the logged IP. | `apps/logs/middleware.py` | Use `REMOTE_ADDR` unless XFF comes from a trusted proxy. |
| L3 | Low | **`text/*` preview streams raw content inline** (incl. `text/html`, `.svg`) with no `Content-Disposition`/CSP. No rendering sink exists today, but the surface is fragile. | `apps/resources/views.py` (preview) | Restrict preview to whitelisted plain-text extensions; force `attachment` otherwise; set `Content-Type: text/plain`. |
| L4 | Low | **Email-existence oracle** on `POST /tenant-requests/email-check/` (platform-wide `User.objects.filter(email__iexact=…)`). | `apps/tenants/request_views.py:36-62` | Return a symmetric `200 available` envelope; move "already exists" detail behind auth. |
| L5 | Low | **Public `/health/` leaks dependency latency + error strings** (version/SDK recon). | `apps/common/views.py` | Strip internals from the public payload; keep detail on the superuser `/platform/system/health/`. |
| L6 | Low | **No CSRF enforcement on cookie-auth endpoints.** Relies on SameSite=Strict cookies + rotation. If `AUTH_COOKIE_SAMESITE` is ever lifted for cross-site deploys, refresh/forced-logout CSRF becomes real. | `config/settings.py:208-239`, `apps/accounts/authentication.py` | Enforce DRF CSRF on state-changing cookie-auth requests in prod, and require an explicit opt-in to relax SameSite. |
| L7 | Low | **Learning viewsets scope by `user` only** (no explicit `tenant`), relying solely on RLS. | `apps/learning/views.py` | Add `tenant=request.user.tenant` to the querysets (defense-in-depth). |
| L8 | Low | **Django `/admin/` exposed** with stock controls. | `config/urls.py:16` | Disable in prod or IP-allowlist + MFA. Also consider gating `/api/schema*` (OpenAPI docs leak the full endpoint map). |
| L9 | Low | **Token blacklist rows grow forever** (rotation never purges). | `config/settings.py:248-249` | Add a beat task sweeping `blacklistedtoken__created_at__lt`. |

### Secrets / hygiene (deploy-day)
- Rotate `GEMINI_API_KEY` + `COMPOSIO_API_KEY` in the real `.env` before any prod exposure (dev values live there now). A commented line in `.env` contains a real-looking password — scrub and rotate.
- `seed_demo.py` hardcodes `DemoAdmin123!` — dev fixture only; do not ship or include in seed data for prod tenants.
- Prod fail-fast guards (`settings.py:435-453`) already reject default Postgres/RabbitMQ/MinIO creds when `DEBUG=False` — do **not** weaken them.
- The prod security block (HSTS 1y + preload, Secure/HttpOnly/SameSite cookies, `X-Content-Type-Options`, `Referrer-Policy`) activates automatically when `DEBUG=False`. Verify it exported in a real deployment.

---

## 3. Correctness & performance (open)

| # | Severity | Finding | Location | Action |
|---|----------|---------|----------|--------|
| H2 | High | **Chat session list N+1** — `get_last_message_at` + `get_message_count` bypass the `prefetch_related("messages")` → ~40-200 extra queries. | `apps/chat/serializers.py:71-76` | Annotate with `Max('messages__created_at')` + `Count('messages')`; drop the prefetch. |
| H3 | High | **Quiz list N+1 for students** — `attempt_count`/`best_score`/`last_attempt_at` query per quiz (page_size=50 → ~150 queries). | `apps/assessments/serializers.py:69-96` | Ingest into a single grouped subquery/`Prefetch`. |
| H4 | High | **Quiz attempt list N+1** — `get_total_questions`/`get_correct_count` run COUNTs; `get_review` re-queries questions. | `apps/assessments/serializers.py:137-165` | Reuse the `quiz__questions` prefetch; cache counts. |
| M2 | Medium | **Quiz submit double-fetch + race** — unlocked `get_object()` then `select_for_update().get()`; a deleted row between them → 500; prefetched questions discarded. | `apps/assessments/views.py:162-167` | Lock once from the URL pk. |
| M3 | Medium | **Chat history paginated at 20/page with heavy prefetch** — `sources__chunk__resource_version__resource` pulls full Resource rows per message. | `apps/chat/views.py:99-129` | `Prefetch(...).only(...)`; raise or make `page_size` explicit. |
| M4 | Medium | **`is_current` check-then-set race** on session/semester creation. | `apps/academics/` + migration 0004 | Unique partial index or locked gate. |
| M5 | Medium | **Quiz generation `.order_by("?")[:40]`** — unbounded RANDOM scan of chunk table. | `apps/assessments/tasks.py:112` | Seeded sampling / `TABLESAMPLE`. |
| M6 | Medium | **Lexical retrieval builds `SearchVector` per row, no GIN index** on `ResourceChunk.content` → timeout on large tenants. | `apps/knowledge/retrieval.py:202` | Add `SearchVectorField`/GIN migration. |
| M7 | Medium | **Missing composite indexes** for hot filters: `AgentSession (tenant,user)`, `ChatSession (tenant,user)`, `ChatMessage (tenant,session,created_at)`, quizzes `(tenant,status)`. | `apps/agent/models.py`, `apps/chat/models.py` | Add `Meta.indexes`. |
| M8 | Medium | **Notification feed triggers a full dashboard build** per invocation. | `apps/notifications/services.py:~300` | Cache or incrementalize `_build()`. |
| M9 | Medium | **Summarization swallows persistence failures** — resource ends `completed` with no summary and no visible error. | `apps/resources/summary_tasks.py:72` | Re-raise/non-transient succeed. |
| M10 | Medium | **Ingestion retries permanent failures** (invalid-file `ValueError`s re-flip FAILED→PENDING). | `apps/resources/tasks.py` | Retry only a `RetryableIngestionError`; fail-fast the rest. |
| L10 | Low | **Quiz attempt list capped at 20** ("Past attempts" hides the rest). | `frontend QuizTakePage.jsx:54` | Product decision: paginate or raise `page_size` on the frontend. |

---

## 4. Deployment readiness

| # | State | Item | Action |
|---|-------|------|--------|
| 1 | **Risk** | `docker-compose.yml` has `backend`/`worker` services **commented out** (lines 90-126) — nothing orchestrates the app today. | Un-comment + wire `depends_on`/health ordering, or ship a separate app-compose. |
| 2 | **Risk** | **No backup strategy** anywhere (no pg_dump scripts, no docs). Volumes survive restarts, not data loss. | Add nightly `pg_dump` + MinIO mirror + restore drill. |
| 3 | **Risk** | **No static-file serving in prod** — no WhiteNoise, no `collectstatic` in Dockerfile, no nginx/CDN for backend statics → Django admin assets 404. | Add WhiteNoise (or `collectstatic` + serve from the frontend nginx tier). |
| 4 | **Risk** | **No Celery beat service** in compose, yet `CELERY_BEAT_SCHEDULE` exists (suspended-login restriction). | Deploy a beat container or the periodic task silently never runs. |
| 5 | Partial | **Gunicorn** hard-coded `--workers 2`, no config file/preload. | Move to a `gunicorn.conf.py` (`worker_class`, preload, graceful timeout). |
| 6 | Partial | **All infra ports published to host** (5432/6379/5672/15672/9000/9001/1025/8025), no custom network, no resource limits, container runs as root. | Prod: network isolation, `expose` only, `deploy.resources`, non-root `USER`. |
| 7 | Partial | **`.env.example` missing optional knobs**: `SENTRY_DSN`/`SENTRY_TRACES_SAMPLE_RATE`, `DJANGO_ENV`, `CLAMAV_STRICT`, `AUTH_COOKIE_*`, `CELERY_TASK_ALWAYS_EAGER`, `SENTRY_RELEASE`, `EMB_CACHE_TTL`, `DB_CONN_MAX_AGE`. | Document the full set. |
| 8 | Partial | **Logging** is console-only, non-JSON. | Add JSON formatter + remote/rotation handler in prod; or rely on container log collection. |
| 9 | Partial | **Sentry** env-gated and off by default; `send_default_pii=True` is deliberate but exports PII (email/IP) when enabled. | Confirm policy before enabling; use `send_default_pii=False` + explicit extracts if in doubt. |
| 10 | OK | Health endpoints: `/health/` (liveness), `/health/ready/` (readiness, 503 on DB/Redis down), `/platform/health/` (superuser deep check incl. RabbitMQ/DLQ/MinIO). | Wire readiness into LB/orchestrator; deep health into alerting. |
| 11 | OK | RLS: applied automatically on every `migrate` via a `post_migrate` receiver (`apps/common/apps.py`) — no separate step. `setup_dlq` must run once against RabbitMQ. | Add `setup_dlq` to the deploy script before startup. |

---

## 5. Deploy-day runbook

```bash
# Prereqs
export DJANGO_DEBUG=False DJANGO_SECRET_KEY=<fresh> DJANGO_ALLOWED_HOSTS=<domain>
export POSTGRES_PASSWORD=<strong> AWS_SECRET_ACCESS_KEY=<strong> CELERY_BROKER_URL=<strong>
# Optional: SENTRY_DSN, GEMINI_API_KEY, VITE_API_BASE_URL, VITE_SENTRY_RELEASE

cd backend
.\.venv\Scripts\python.exe manage.py migrate          # auto-enforces RLS via post_migrate

# One-time per broker
.\.venv\Scripts\python.exe manage.py setup_dlq          # RabbitMQ DLX + dead-letter queue

# (prod) collect static into STATIC_ROOT if not using WhiteNoise
```

Start order: `db → redis → rabbitmq → minio → migrate → web → worker → beat`.

**Verify**
- [ ] `GET /api/v1/health/ready/` returns 200 with `db` + `cache` ok
- [ ] `/api/v1/admin/` reachable only by staff/login works (or disabled)
- [ ] Cookie attributes: `HttpOnly; SameSite=Strict; Secure; Path=/api/v1`
- [ ] RLS locked down: run a query as the app role against a row in another tenant → empty
- [ ] `manage.py smoke_check --with-db`
- [ ] Deep health shows RabbitMQ workers + DLQ depth 0
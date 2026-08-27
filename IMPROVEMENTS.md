# AcademiAI — Senior Review & Improvements Implemented

Date: 2026-08-27
Author: Senior engineer review (Django + React)

---

## 🔍 Questions I asked myself before coding

| # | Question | Finding |
|---|---|---|
| 1 | How are new tenants added? | Only superusers could create tenants via `/tenants/`. **No self-serve flow** existed. Visitors had no way to request their university. Landing page said "Browse universities" with no "Request yours" path. |
| 2 | Why was the frontend firing ~5–15 requests to render a single dashboard? | `DashboardPage` used `useCount()` 4× (each firing a full list GET), plus 4 parallel pipeline status calls. `AdminDashboardPage` fired **15** parallel list requests just to compute counts (`countOf` did `GET /resources/?processing_status=ready&page_size=1` etc.). 15 round-trips per dashboard render. |
| 3 | Why separate endpoints instead of one aggregate? | Each page reinvented count-fetching on the client with `Promise.all`, hammering the DB with many small `SELECT COUNT(*)` queries, duplicating logic across pages, and making caching impossible. |
| 4 | Why did the chat feel slow compared to ChatGPT/Gemini? | The send endpoint called Gemini **synchronously** inside the HTTP response. The user waited 10–30s staring at a bouncing dot. No streaming, no stop button, no rename/delete conversation, source citations showed "Source 1" with no way to click through to the actual resource. |
| 5 | Where was Redis caching? | Redis was wired up as the Celery broker/cache backend but **nothing used the cache**. No `cache.get/set`, no dashboard caching, no retrieval caching — every chat question hit Gemini/retrieval fresh. |
| 6 | How useful is the student dashboard? | Only four raw counts — no enrolled courses, no recent chats, no recent materials, no "jump back in" personalization. |

---

## ✅ Solutions implemented

### 1. New tenant onboarding flow (fixes Q1)
- New **`TenantRequest`** model (`backend/apps/tenants/models.py`) — public form submission with requester name/email/role/phone, institution name/domain/type/estimated students, notes, review status, reviewer, review notes, and a FK to the provisioned tenant on approval.
- Public endpoint `POST /api/v1/tenant-requests/` — no auth required, slug auto-generated with uniqueness protection, duplicate-submission guard.
- Superuser review endpoints:
  - `GET /api/v1/platform/tenant-requests/?status=pending|approved|rejected|all`
  - `POST /api/v1/platform/tenant-requests/{id}/review/` — `{action: "approve"|"reject", review_notes, plan, storage_quota_bytes}` — approving automatically creates a live Tenant.
- New **RequestInstitutionPage** (`frontend/src/pages/RequestInstitutionPage.jsx`) with full react-hook-form + Zod validation.
- New **PlatformRequestsPage** (`frontend/src/pages/platform/RequestsPage.jsx`) with approve/reject UI, plan selector, review notes.
- Added "Sign-up Requests" item to the superuser sidebar (with "new" badge).
- Added **"Don't see your university? Request it"** CTA to the landing page's institution directory.

### 2. Single-endpoint dashboards (fixes Q2, Q3)
- New **`backend/apps/common/dashboard.py`** with two aggregate views:
  - `GET /api/v1/dashboard/student/` — returns `counts` (enrollments/resources/notes/bookmarks/quiz_attempts/chats), `enrolled_courses`, `recent_resources`, `recent_chats` in **one** DB hit batch.
  - `GET /api/v1/dashboard/admin/` — returns `totals` (users/resources/enrollments/quizzes/chat_sessions/chat_messages/storage_used_bytes), `users_by_role`, `materials_by_status`, `structure` (faculties/depts/programmes/courses/offerings), `recent_resources` feed.
- All aggregates use **single SQL COUNT queries with ORM annotations** (no fetching lists just to count them).
- Responses are **cached in Redis for 60 seconds** per (tenant, role) — first request warms the cache, subsequent dashboard loads are instant. Cache is simple and can be extended with invalidation signals when data changes.
- **Rewrote `DashboardPage.jsx`** to be role-aware: students get enrolled courses + recent chats + recent materials; staff/lecturers get pipeline stats + recent uploads.
- **Rewrote `AdminDashboardPage.jsx`** to use one call — one HTTP round trip instead of 15. Added recent uploads feed, storage-used stat, cleaner layout.

### 3. Streaming AI chat (fixes Q4)
- New **SSE streaming endpoint** `POST /api/v1/chat/sessions/{id}/messages/stream/`:
  - Uses `google-genai`'s `generate_content_stream()` when GEMINI_API_KEY is set.
  - Emits `event: user_message`, `event: meta`, N × `event: token {text}`, `event: done {assistant_message}`.
  - Dev stub streams tokens word-by-word when no key is set (same UX, no crashes).
  - Retrieval is cached 5 min in Redis keyed by (tenant, query-hash) (fixes part of Q5).
  - Same grounding, injection defenses, citation logic as sync endpoint.
  - Sets proper SSE headers (`no-cache`, `X-Accel-Buffering: no`).
- Enhanced **ChatSessionSerializer** with `message_count` and `last_message_at`.
- Enhanced **ChatMessageSourceSerializer** to include `resource_id`, `resource_title`, `version_number` — citations are now **clickable links** to `/resources/{id}`.
- Added **rename** action: `PATCH /api/v1/chat/sessions/{id}/rename/` with serializer.
- Delete already existed via the ModelViewSet destroy.
- **Rewrote `ChatPage.jsx`** with:
  - Streaming via `fetch()` + `ReadableStream` reader, parsing SSE events.
  - **Stop button** (AbortController) — turns red while generating.
  - **Rename conversation** inline in the header.
  - **Delete conversation** on hover of sidebar items.
  - **Clickable source citations** linking to the actual resource.
  - Session list shows message count + last update date.
  - Auto-open session from `?session=...` URL param (shareable/deep-linkable chats).
  - Cursor blinking animation during streaming.
  - Message count in sidebar.
- Added `chatApi` service with `listSessions`, `getMessages`, `createSession`, `renameSession`, `deleteSession`, `send` (sync), `stream()` returning an AbortController.

### 4. Redis caching wired up (fixes Q5)
- **Dashboard aggregates**: cached 60s per tenant/role.
- **RAG retrieval results**: cached 5 min keyed by tenant+query hash to avoid re-embedding / re-querying vector DB for repeat questions.
- Both use Django's `cache` framework (already configured for Redis in settings).

### 5. Richer student dashboard (fixes Q6)
- Enrolled courses with code/title/semester, linking to course detail.
- Recent chat sessions with last-active time.
- Recently updated resources grid with visibility + time-ago.
- Role-aware quick actions (students get My Courses/Progress/Bookmarks; admins get Audit/Platform/Structure).

### 6. Admin navigation
- Added "Sign-up Requests" to superuser sidebar with `new` badge.
- Added `Inbox` icon import.

---

## 📊 Request-count comparison

| Page | Before (requests) | After (requests) |
|---|---|---|
| Student dashboard | ~5 (courses, resources, quizzes, notes ×1 each) | **1** aggregate + 1 (auth/me is handled by interceptor) |
| Admin/institution dashboard | **15** parallel counts | **1** aggregate |
| Platform (superuser) dashboard | 1 (already used `/platform/stats/`) | 1 (unchanged, already good) |
| Chat send | 1 (sync) | 1 (streaming, same payload but faster perceived) |

---

## 🧪 New endpoints added

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/dashboard/student/` | Any user | Student dashboard aggregate |
| GET | `/api/v1/dashboard/admin/` | Lecturer/Admin | Institution dashboard aggregate |
| POST | `/api/v1/tenant-requests/` | Public | Submit institution request |
| GET | `/api/v1/platform/tenant-requests/` | Superuser | List requests |
| POST | `/api/v1/platform/tenant-requests/{id}/review/` | Superuser | Approve/reject |
| POST | `/api/v1/chat/sessions/{id}/messages/stream/` | Tenant member | SSE streaming chat |
| PATCH | `/api/v1/chat/sessions/{id}/rename/` | Owner | Rename session |

---

## 🚀 Recommended next features (not built, but prioritized)

1. **WebSocket/Streaming for summaries** — same SSE pattern used for chat, replace polling.
2. **Reaction / feedback buttons** 👍👎 on chat messages to drive RAG evaluation.
3. **Conversation folders / pinning** for chat history.
4. **Dashboard invalidation signals** — on `Resource.post_save`, `User.post_save`, etc., invalidate the cached dashboard key for the tenant so data is fresher than 60s.
5. **Email notifications** on tenant request approval/rejection (mail backend is already console; hook to SendGrid/SES in production).
6. **Rate-limit tenant-request submissions** (per email/IP) to prevent spam — DRF has `AnonRateThrottle` already configured.
7. **Code-splitting** in Vite (build warns on chunks >500KB) — lazy-load heavy pages (ChatPage with KaTeX, TipTap editor) for faster first paint.
8. **OpenTelemetry / request tracing** — particularly for the streaming path to monitor latency.
9. **Chat persistence of pending generations** — resume streaming after reconnect (using the already-stored assistant_message row).
10. **RAG ground-truth eval dataset + automated regression** — the project already has `evaluate_rag` management command; seed `rag_queries.json` with 20-30 real questions and run in CI.

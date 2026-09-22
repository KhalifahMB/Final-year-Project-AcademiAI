# AI chat & agent deployment checklist

Deployment, security, correctness, and cost-control items specific to the
AI pipeline (grounded chat, tool-using agent, RAG retrieval). Companion
backend checklist: `docs/DEPLOYMENT_BACKEND.md`.

Legend: **Fixed** = applied this round (verified by tests); items without a status are open.

---

## 1. Architecture at a glance

Two independent AI subsystems:

| | Chat (classic grounded Q&A) | Agent (tool-using persona) |
|---|---|---|
| Endpoint | `POST /chat/sessions/{id}/messages/` + `/stream/` | `POST /agent/stream/` |
| Streaming | True token-level SSE | SSE-framed, but **one non-streaming Gemini call** (typewriter is client-side) |
| History in prompt | **None** — stateless per turn | Last 20 messages replayed (`AGENT_HISTORY_SLOTS`) |
| Context | RAG chunks (canary-wrapped) + 1 user message | System prompt (sanitized) + history + tool results |
| Rate limit | `AiRateThrottle` 30/min | `AiRateThrottle` 30/min |

All LLM calls funnel through `apps/common/ai/gemini.py` (`generate_content`,
`generate_content_stream`). Keyless `GEMINI_API_KEY` degrades to deterministic
dev stubs — documented, but see §3.

---

## 2. Already fixed (verified — `apps/agent` + `apps/assessments` tests 11/11)

| Finding | Where | What changed |
|---------|-------|--------------|
| **F2 — resumed agent sessions broke** | `apps/agent/agent_loop.py:84-88` | Stored history uses role `"assistant"`, but Gemini's contents API only accepts `user`/`model` → every second message in a resumed session failed with INVALID_ARGUMENT. The replay loop now maps `assistant → model`; storage keeps `"assistant"` (frontend contract unchanged). |
| **H5 — `message_count` race** | `apps/agent/views.py:81-83` | Atomic `F()` increment instead of read-modify-write, so concurrent streams can't clobber the count. |
| **F1 — unbounded agent input** | `apps/agent/views.py:105` | `message` capped at 10,000 chars (mirrors the chat serializer) — rejects context/cost abuse. |

> The agent turn still sends **history + tool results** into the model with the
> caps requested by the model window (gemini-1.5-flash ≈ 1M tokens), but a
> per-turn token budget would still be worthwhile — see §3.

---

## 3. Open HIGH/MEDIUM items (remediation required before production AI)

| # | Severity | Finding | Location | Action |
|---|----------|---------|----------|--------|
| F3 | High | **No output content moderation / PII filtering.** No `safety_settings` sent to Gemini; toxic/harmful output reaches users verbatim and is persisted. Academic product, potentially minors. | `apps/common/ai/gemini.py:202-209`, `apps/agent/agent_loop.py:113-117`, `apps/chat/services/turns.py:124-127` | Configure `safety_settings` (block HIGH/medium on designated categories), screen output for raw HTML/scripts, decide on PII redaction. |
| F4 | Medium-High | **Tool results fed back to the model unsanitized** (e.g. `Resource.title` from `search_resources`) — no `_sanitize_context`, no canary markers. A document/title containing an injection payload reaches the reasoning context. | `apps/agent/agent_loop.py:158-168` | Reuse `_sanitize_context` on `tool_results` strings and wrap in canaries. |
| F5 | Medium | **Chat turns are stateless** — the prompt never includes conversation history, so follow-ups ("and Q2?") have no memory despite full history existing in DB. Core UX gap for a tutor. | `apps/chat/services/turns.py:115-119`, `apps/common/ai/gemini.py:236-240` | Product decision: fold recent messages into context (with a modest window/char budget). |
| F7a | Medium | **Mid-stream Gemini failure persists the error string as an assistant chat message.** | `apps/chat/services/turns.py:134-138,151` | Persist only successful content; keep errors transient. |
| F7b | Medium | **Tool exception text (`str(e)`) leaks to clients + `AgentToolExecution.output_summary`** — may include ORM/SQL internals. | `apps/agent/tools.py:381-382` | Return a sanitized error summary, log the detail server-side. |
| F7c | Medium | **`AiInsightView` has no AI-specific throttle** (defaults to 2000/user/hr) — hundreds of paid `generate_content` per user per hour possible. | `apps/common/dashboard.py:1154` | Attach `AiRateThrottle` (or a dedicated scope) + per-tenant quota. |
| F7d | Low-Med | **Dead/misconfigured AI config**: `apps.chat.tasks` + `apps.knowledge.tasks` routed but don't exist; `AgentSettings.filters` (accessibility toggles) stored but never applied to prompts — the UI advertises settings that silently do nothing. | `config/settings.py:344-345`, `apps/agent/models.py:63-67` | Remove dead routes; wire `filters` or remove the UI. |

---

## 4. Cost & quota controls (no token accounting exists)

- **No per-user/tenant token or cost tracking anywhere.** `ResourceChunk.token_count` is a word count, dead weight.
- Spend controls today = `AiRateThrottle` (30/min/user) + Redis query-embedding cache (5 min) + retrieval cache (5 min).
- Plans:
  - [ ] Per-message char/token budget in `run_agent_turn` (history + tool results trim to a cap before the call).
  - [ ] Per-tenant daily AI quota (a simple `AiUsage` ledger or Redis counter at the throttle scope).
  - [ ] Emit one audit/usage row per Gemini invocation (model, prompt tokens, output tokens, latency) — reuse the existing audit hooks.
  - [ ] Attach throttles to the remaining AI touchpoints (`AiGreetingView`, `AiInsightView`, `summarize_resource_task` ingress).

---

## 5. LLM integration hardening

- **`GEMINI_API_KEY` is not covered by the prod fail-fast guards** (`settings.py:435-453`) — an empty key silently degrades to dev stubs in prod. Add a `DEBUG=False` guard that requires the key.
- **No retry/backoff or status-code discrimination** on Gemini failures (429/500/400 identical; chat/agent generation retries zero times, while ingestion/summarization do). Add retry with backoff for 429/5xx; keep 4xx fail-fast.
- **Agent "streaming" is not real streaming** — one `generate_content` per turn, then a single big SSE token event. If perceived latency matters, switch the loop's final call to `generate_content_stream` and forward tokens as they arrive.
- **Concurrency**: chat/agent writes to the same session are un-locked; parallel SSE generations on one session can interleave history/`recent_messages`. Guard with `select_for_update` around session state mutations (or a per-session mutex).

---

## 6. RAG / retrieval deploy items

| Finding | Location | Action |
|---------|----------|--------|
| Lexical `SearchVector("content")` computed per row, no GIN index | `apps/knowledge/retrieval.py:202` | `SearchVectorField` / GIN migration (also blocks M6 in the backend checklist). |
| Semantic retrieval has **no similarity threshold** — takes top-k nearest regardless of absolute similarity. Irrelevant chunks can rank. | `apps/knowledge/retrieval.py:223` | Add a minimum cosine-similarity gate before RRF. |
| Chunks have no page/section metadata; a fixed 1200-char window with 150 overlap may split mid-word. | `apps/resources/tasks.py:17,164` | Add boundary-aware splitting + metadata; `metadata` is currently `{}`. |
| Embedding failures silently store `embedding=NULL` (excluded from semantic search). Fine, but silent. | `apps/common/ai/gemini.py:332` | Log a metric when `None` vectors occur — indicator of provider trouble. |
| **Authorization-first retrieval is solid** (RLS + per-tenant allowlist + cache keys + chunk-level re-checks on citations; private items owner-only even for admins). | `apps/knowledge/retrieval.py:52-145`, `apps/chat/services/store.py:70-72` | Preserve; add an integration test per new resource model. |

---

## 7. Production deploy runbook (chat/agent specific)

```bash
# Env
export GEMINI_API_KEY=<real key>            # add fail-fast guard for this in DEBUG=False
export GEMINI_MODEL=gemini-1.5-flash        # default; verify context window assumptions
export GEMINI_EMBEDDING_MODEL=text-embedding-004
export EMB_CACHE_TTL=300                    # redis rAG/embedding cache TTL

# After migrate (see DEPLOYMENT_BACKEND.md)
# First-turn smoke: POST /agent/stream/ {"message":"hello","context_type":"dashboard"} → SSE tokens
# Resume smoke:    POST again with the returned session_id → second turn must NOT 400 (F2 guard)
```

**Pre-launch gate**
- [ ] `safety_settings` configured and a known-toxic prompt returns a blocked/safe response
- [ ] A resource whose *title* contains an instruction-injection payload does not alter agent behavior (F4 guard)
- [ ] Chat follow-up turns carry prior context (product decision on F5)
- [ ] Agent history rows contain no `assistant` role sent to Gemini (F2 regression test exists)
- [ ] Oversized agent message (11k chars) returns 400, not a Gemini call
- [ ] Token/cost ledger emitting per-call usage rows
- [ ] `AiInsightView`/`AiGreetingView` throttled
- [ ] No `str(e)` internals reach SSE `tool_result` events (F7b guard)
- [ ] Two concurrent streams on one session don't corrupt `recent_messages`/`message_count`
- [ ] Keyless `GEMINI_API_KEY` is impossible in prod (fail-fast guard)
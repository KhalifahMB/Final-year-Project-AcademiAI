# Acceptance Matrix — Execution Results

Executed against the running dev stack on 2026-10-11 (Windows / PowerShell).

- **Code under test:** `backend/` on branch `feat/frontend-redesign`
- **Infra:** Docker DB/Redis/RabbitMQ/MinIO up; backend `.venv`
- **Test artifact:** `backend/apps/common/tests/test_acceptance_matrix.py` (one test per row)
- **Command:**
  ```powershell
  cd backend
  .\.venv\Scripts\python.exe -m pytest apps/common/tests/test_acceptance_matrix.py -v -s -n 0
  ```
- **Result:** `12 passed` (12 rows: 1–7, 8a, 8b, 9–11). Runtime ≈ 190 s (includes test-DB create/migrate).

> Status legend: **PASS** = brief's expectation met by the shipped implementation.
> The rows below were first run against the code as-is (7 rows mismatched); the code was then
> changed to close each gap, and the matrix re-run clean.

| # | Scenario | Expected (brief) | Actual result | Status | Remarks |
|---|---|---|---|---|---|
| 1 | RBAC — Student reads admin analytics | `GET /api/v1/admin/usage` → **403** | `GET /api/v1/admin/usage/` → **403** (student); **200** (admin, tenant usage totals) | PASS | New `AdminUsageView` (`apps/common/dashboard.py`), gated by `IsAdminRoleOrSuperuser`; routed in `apps/tenants/urls.py`. |
| 2 | RBAC — Lecturer A reads course B roster | `GET /courses/{B}/roster` → **403** | **403** for unassigned lecturer and for students; **200** (with enrolled students) for an assigned lecturer | PASS | New `roster` action on `CourseViewSet` (`apps/academics/views.py`): admin, or lecturer assigned to any offering of the course. |
| 3 | Auth — valid login | 200 + JWT | **200** with `access` + `refresh` + `user` | PASS | `POST /api/v1/auth/login/`. Also sets HttpOnly auth cookies. |
| 4 | Auth — wrong password | 401 | **401** | PASS | Reason: "Invalid credentials." |
| 5 | Auth — expired access token | 401 | **401** | PASS | Expired `AccessToken` on `GET /api/v1/auth/me/`. |
| 6 | Upload — Lecturer PDF, visibility "public", ingestion triggered | 201 + resource id + ingestion dispatched | **201** (scope stored as `institution`); presign **200**; `complete_upload` **200**; ingestion job queued | PASS | `public` is now accepted as an alias for the tenant-wide `institution` scope (`ResourceSerializer.validate`); it is canonicalized before storage. |
| 7 | Upload — Student PDF, no visibility → private, uploader-only | 201; `visibility = private`; only uploader can see | **201**; `visibility_scope = "private"`; uploader → 200, other student → **404** | PASS | A student's personal upload (no `course_offering`) now defaults to `private` (`ResourceSerializer.validate`). Offerings still default to `course`. |
| 8a | Upload — disallowed file type | 400 | **400** — "Disallowed content type: application/x-msdownload" | PASS | Rejected synchronously in `validate_upload_bytes` (`apps/common/security/file_validation.py`). No resource row created. |
| 8b | Upload — malware (EICAR) | Quarantined; `status=failed`; no chunks | Quick-upload path: **400** pre-storage. Worker scan path: resource **`failed`**, `processing_error` = `"Quarantined: … EICAR"`, **no chunks/embeddings/concepts**, AuditLog row `resource.quarantined` | PASS | `process_resource_ingestion` distinguishes malware from transient errors (`MalwareQuarantined`) and quarantines the material. The `/chat/upload/` fast path still rejects EICAR before storage (defense in depth). |
| 9 | Ingestion — PDF chunked + embedded | `ResourceChunk` rows, `status=ready`, **AuditLog row written** | `status=ready`; **1 chunk**; embeddings non-null (dim=768); **AuditLog row `resource.ingestion_completed`** | PASS | The task now writes an audit entry on success (`log_action` inside the tenant-scoped transaction) and on failure (`resource.ingestion_failed`). |
| 10 | Summarize — streamed summary | Streamed summary response | **200** `text/event-stream`; `token` events then `done`; `ResourceSummary` persisted | PASS | New `GET/POST /api/v1/resources/{id}/summarize/stream/` (`summarize_stream` action) streams via `iter_summary_stream` + `generate_summary_stream`. The async `POST /summarize/` (202 + `job_id`) still exists. |
| 11 | Chat RAG — cites retrieved chunk | Answer cites the retrieved chunk | **201**; assistant `retrieved_chunk_ids` = `[chunk.id]`; `ChatMessageSource` row persisted | PASS | Verified end-to-end through the real retrieval path (attached-resource fold → `generate_grounded_answer` → citation persistence). |

## Behavior changes applied

All changes are additive/backward-compatible except the two default/alias rules noted below.

1. **Admin usage endpoint** — `GET /api/v1/admin/usage/` (admin-only) exposing tenant usage aggregates
   (`AdminUsageView` in `apps/common/dashboard.py`, route in `apps/tenants/urls.py`).
2. **Course roster endpoint** — `GET /api/v1/courses/{id}/roster/` with admin/assigned-lecturer authz
   (`CourseViewSet.roster`).
3. **`public` visibility alias** — accepted and canonicalized to `institution`
   (`ResourceSerializer`).
4. **Student default scope** — a student upload with no scope and no offering stores `private`
   (previously the model default `course`).
5. **Malware quarantine** — the ingestion worker marks a scanned-bad object `failed`, records
   `Quarantined: …`, writes nothing to the corpus, and audits it. Malware is separated from transient
   errors so it is not silently retried into the corpus.
6. **Ingestion audit trail** — `resource.ingestion_completed` / `resource.ingestion_failed` /
   `resource.quarantined` audit rows.
7. **Streamed summarization** — SSE endpoint that emits tokens and persists the completed summary.

## Regression coverage

After the changes, the affected suites pass:

```powershell
.\.venv\Scripts\python.exe -m pytest apps\resources\tests apps\academics\tests apps\common\tests   # 179 passed
.\.venv\Scripts\python.exe -m pytest apps\chat\tests apps\knowledge\tests apps\tenants\tests apps\notifications\tests   # 40 passed
```

## Notes / environment

- AI calls were monkeypatched in tests (`generate_grounded_answer`, `generate_summary`,
  `generate_summary_stream`, `generate_embeddings`, `extract_concepts`) so results are deterministic
  and don't depend on the live Gemini key. Storage (`get_s3_client`) was stubbed for the ingestion
  and quarantine tests. The SSE test consumes `resp.streaming_content` **inside** the patch context
  because the stream body is lazy.
- Tests run as the `academiai_test` (BYPASSRLS) role per `backend/conftest.py`; app-layer
  tenant filtering and object permissions are still exercised.

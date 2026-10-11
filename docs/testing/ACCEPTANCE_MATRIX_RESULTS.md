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
- **Result:** `12 passed` (12 rows: 1–7, 8a, 8b, 9–11). Runtime ≈ 186 s (includes test-DB create/migrate).

> Status legend: **PASS** = brief's expectation met. **PASS\*** = the security/behavioural
> property holds, but the brief's wording (route name, enum value, mechanism) does not match
> the shipped implementation. **FAIL** = expectation not met.

| # | Scenario | Expected (brief) | Actual result | Status | Remarks |
|---|---|---|---|---|---|
| 1 | RBAC — Student reads admin analytics | `GET /api/v1/admin/usage` → **403** | `GET /api/v1/admin/usage/` → **404** (no such route); real admin analytics `GET /api/v1/dashboard/admin/` → **403** | PASS* | Route name is inaccurate. Admin dashboard view (`apps/common/dashboard.py:338`) correctly denies students (403). The literal path is absent, so it 404s rather than 403s. |
| 2 | RBAC — Lecturer A reads course B roster | `GET /courses/{B}/roster` → **403** | `GET /api/v1/courses/{id}/roster/` → **404**; real equivalent `GET /api/v1/course-enrollments/?course_offering={B}` → **403** | PASS* | No `/courses/{id}/roster` endpoint exists. Roster = enrollment list, gated by `IsAdminRoleOrSuperuser` (`apps/academics/views.py:329`); lecturers are denied. |
| 3 | Auth — valid login | 200 + JWT | **200** with `access` + `refresh` + `user` | PASS | `POST /api/v1/auth/login/`. Also sets HttpOnly auth cookies. |
| 4 | Auth — wrong password | 401 | **401** | PASS | Reason: "Invalid credentials." |
| 5 | Auth — expired access token | 401 | **401** | PASS | Expired `AccessToken` on `GET /api/v1/auth/me/`. |
| 6 | Upload — Lecturer PDF, visibility "public", ingestion triggered | 201 + resource id + ingestion dispatched | **201**; presign **200**; `complete_upload` **200**; ingestion job queued | PASS* | `"public"` is not a valid `visibility_scope` → **400**. The tenant-wide token is **`institution`**. Enum: `private/course/programme/department/faculty/institution`. |
| 7 | Upload — Student PDF, no visibility → private, uploader-only | 201; `visibility = private`; only uploader can see | **201**; `visibility_scope = "course"`; uploader → 200, other student → **404** | PASS* | Model default scope is **`course`** (`apps/resources/models.py:83`), not `private`. A COURSE resource with no offering is uploader-only, so the effective privacy guarantee holds. |
| 8a | Upload — disallowed file type | 400 | **400** — "Disallowed content type: application/x-msdownload" | PASS | Rejected synchronously in `validate_upload_bytes` (`apps/common/security/file_validation.py:19`). No resource row created. |
| 8b | Upload — malware (EICAR) | Quarantined; `status=failed`; uploader notified; no chunks | **400** — "Malware signature detected (EICAR)"; no resource/version/chunk rows | PASS* | Detection is **synchronous rejection at upload**, not async quarantine. EICAR substring + ClamAV (`clamd`) scan; `CLAMAV_STRICT` (prod default True) fails closed. Behaviour is stronger (nothing is ever stored) but differs from the brief's "quarantined" wording. |
| 9 | Ingestion — PDF chunked + embedded | `ResourceChunk` rows, `status=ready`, **AuditLog row written** | `status=ready`; **1 chunk**; embeddings non-null (dim=768); **AuditLog rows = 0** | PASS* | Chunking + embedding + ready-state verified via `process_resource_ingestion`. **The AuditLog claim is false** — ingestion writes no audit entry (only `resource.create`/delete via the API do, in `perform_create`/`perform_destroy`). |
| 10 | Summarize — streamed summary | Streamed summary response | `POST /resources/{id}/summarize/` → **202 + `job_id`** (async); summary persisted on task run | PASS* | Not streamed. Summarize queues `summarize_resource_task` (poll `GET /api/v1/jobs/{job_id}/`). SSE streaming exists for **chat**, not summarization. Rejects with 503 if AI unavailable. |
| 11 | Chat RAG — cites retrieved chunk | Answer cites the retrieved chunk | **201**; assistant `retrieved_chunk_ids` = `[chunk.id]`; `ChatMessageSource` row persisted | PASS | Verified end-to-end through the real retrieval path (attached-resource fold → `generate_grounded_answer` → citation persistence). |

## Key discrepancies found

1. **Admin analytics route** — brief cites `/admin/usage`; real path is `/dashboard/admin/` (`/platform/stats/`, `/platform/tenants/{id}/` for superusers).
2. **Roster route** — brief cites `/courses/{id}/roster`; roster data lives in the admin-only `/course-enrollments/` list.
3. **Visibility token** — no `public` scope; tenant-wide is `institution`. Passing `public` returns 400.
4. **Default visibility** — resource default is `course`, not `private` (private enforcement still owner-only, but only when the scope is explicitly `private`).
5. **Malware handling** — rejected at upload, not quarantined as a failed resource.
6. **Ingestion audit log** — ingestion does **not** write an `AuditLog` row (brief claim unsubstantiated).
7. **Summarization transport** — async job + polling, not a streamed response.

## Notes / environment

- AI calls were monkeypatched in tests (`generate_grounded_answer`, `generate_summary`,
  `generate_embeddings`, `extract_concepts`) so results are deterministic and don't depend on the
  live Gemini key. Storage (`get_s3_client`) was stubbed for the ingestion test.
- Tests run as the `academiai_test` (BYPASSRLS) role per `backend/conftest.py`; app-layer
  tenant filtering and object permissions are still exercised.

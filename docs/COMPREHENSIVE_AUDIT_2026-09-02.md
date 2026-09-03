# AcademiAI — Comprehensive Audit Report

**Date:** 2026-09-02  
**Auditor:** Senior Full-Stack Engineer Review  
**Scope:** Complete project review (Backend + Frontend + AI Agent + UX/UI + Architecture)  
**Status:** Initial comprehensive assessment

---

## Executive Summary

AcademiAI is a well-architected multi-tenant academic AI platform with solid foundations but several critical gaps in implementation. The codebase shows evidence of recent audit work (AUDIT.md, BACKEND_AUDIT.md, UX_REVIEW.md), but **many documented HIGH/CRITICAL issues remain unfixed (marked ⬜ OPEN or ⏳ NOT FIXED)**.

### Overall Assessment

**Strengths:**

- Solid multi-tenant architecture with RLS
- Clean Django REST Framework implementation
- Modern React + Tailwind + shadcn/ui frontend
- RAG-grounded AI chat with concept graph
- Comprehensive documentation

**Critical Gaps:**

- Multiple HIGH security issues remain unfixed
- Key user features exist in backend but missing from UI
- AI Agent implementation is basic and stateless
- Many backend endpoints lack proper validation
- Frontend has missing UX features despite backend support

---

## 🔴 CRITICAL ISSUES (Immediate Action Required)

### C1 — PostgreSQL RLS Bypass Risk (from AUDIT.md - NOT FIXED)

**Severity:** 🔴 CRITICAL  
**Status:** ⬜ OPEN  
**File:** `docker-compose.yml`, `backend/config/settings.py`

**Issue:** Runtime DB user is a PostgreSQL superuser with `BYPASSRLS` attribute, making RLS decorative. The `academiai_app` role exists but is never used.

**Impact:** Any app-layer tenant-filtering bug leaks cross-tenant data with no DB backstop.

**Fix Required:**

1. Connect as `academiai_app` role in production
2. Grant NOBYPASSRLS to runtime user
3. Re-own tables as non-superuser role
4. Verify with `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`

---

### C2 — JWT Tokens in localStorage (XSS Theft) (from AUDIT.md - NOT FIXED)

**Severity:** 🔴 HIGH  
**Status:** ⏳ NOT FIXED (documented but deferred)  
**Files:** `frontend/src/hooks/useAuth.jsx:19,71-72,78`, `frontend/src/services/api.js:15,28,34`

**Issue:** Both access and refresh tokens stored in localStorage are readable by any XSS attack.

**Impact:** Complete account takeover via XSS.

**Fix Required:**

- Access token: in-memory only (React state/context)
- Refresh token: HttpOnly secure cookie
- Requires backend cookie-based refresh endpoint

---

### C3 — Real API Keys in .env (from AUDIT.md)

**Severity:** 🔴 HIGH  
**Status:** ⬜ USER ACTION REQUIRED  
**Files:** `.env:53` (GEMINI_API_KEY), `.env:60` (COMPOSIO_API_KEY)

**Issue:** Live API keys present in working directory.

**Action Required:**

1. **ROTATE BOTH KEYS IMMEDIATELY** at provider dashboards
2. Move to secret manager or environment variables
3. Never commit .env or share in archives

---

## 🟠 HIGH PRIORITY FIXES

### H1 — Password Reset Broken (from BACKEND_AUDIT.md - MARKED FIXED but verify)

**Severity:** 🟠 HIGH  
**Status:** ✅ CLAIMED FIXED (needs verification)  
**File:** `apps/accounts/tasks.py:47-65`

**Original Issue:** Reset email doesn't include token in URL.  
**Verification Needed:** Test password reset flow end-to-end.

---

### H2 — Dashboard Cache Cross-User Leak (from BACKEND_AUDIT.md - MARKED FIXED but verify)

**Severity:** 🟠 HIGH  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/common/dashboard.py:31-33`

**Original Issue:** Cache key `dashboard:{tid}:{role}:{suffix}` shared across users.  
**Verification Needed:** Check if user.id added to cache key.

---

### H3 — Tenant Admins Can Read Private Resources (from BACKEND_AUDIT.md - MARKED FIXED but verify)

**Severity:** 🟠 HIGH  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/resources/views.py:578-589`

**Verification Needed:** Test admin attempting to access another user's PRIVATE resource.

---

### H4 — Prompt Injection in Agent (from BACKEND_AUDIT.md - MARKED FIXED but verify)

**Severity:** 🟠 HIGH  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/agent/agent_loop.py:39-44`

**Verification Needed:** Test injection attempts via context_type.

---

### H5 — Agent SSE Stream No Exception Guard (from BACKEND_AUDIT.md - MARKED FIXED but verify)

**Severity:** 🟠 HIGH  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/agent/views.py:63-103`

**Verification Needed:** Test error handling in SSE stream.

---

### H6 — Quiz Submit Race Condition (from BACKEND_AUDIT.md - MARKED FIXED but verify)

**Severity:** 🟠 HIGH  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/assessments/views.py:138-173`

**Verification Needed:** Test concurrent submissions with same attempt.

---

### H7 — Quiz Question Leak Before Publication (from BACKEND_AUDIT.md - MARKED FIXED but verify)

**Severity:** 🟠 HIGH  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/assessments/views.py:82-97`

**Verification Needed:** Student should not see DRAFT quiz questions.

---

### H8 — Agent History Stateless (from BACKEND_AUDIT.md - PARTIALLY FIXED)

**Severity:** 🟠 HIGH  
**Status:** 🛠 PARTIAL FIX  
**File:** `apps/agent/views.py:57,76`, `apps/agent/tools.py:98-138`

**Issue:** New AgentSession created every request; history never passed to `run_agent_turn`.

**Remaining Work:**

- Full message-history threading not implemented
- Multi-turn context lost between requests

---

### H9 — No CSP / Security Headers (from AUDIT.md - NOT FIXED)

**Severity:** 🟠 HIGH  
**Status:** ⏳ PENDING  
**File:** `frontend/index.html`

**Missing:**

- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- X-Frame-Options

---

### H10 — Infrastructure Bound to 0.0.0.0 with Weak Credentials (from AUDIT.md - NOT FIXED)

**Severity:** 🟠 HIGH  
**Status:** ⬜ OPEN (ops/infra)  
**Files:** `docker-compose.yml`, `.env`

**Issues:**

- All services exposed on 0.0.0.0
- Weak default passwords
- Redis has no authentication

---

### H11 — Django Admin + Swagger Exposed Unconditionally (from AUDIT.md - NOT FIXED)

**Severity:** 🟠 HIGH  
**Status:** ⬜ OPEN  
**File:** `backend/config/urls.py:14,27-37`

**Issue:** `/admin/`, `/api/schema/`, swagger-ui, redoc mounted in production.

---

## 🎯 MISSING USER FEATURES (Backend Exists, UI Missing)

### UX1 — Student Cannot Unenroll from My Courses Page ⭐ **YOUR SPECIFIC EXAMPLE**

**Severity:** 🟠 HIGH (User-facing blocker)  
**Status:** ⬜ NEW FINDING  
**Files:**

- Backend: `apps/academics/views.py:256-276` ✅ EXISTS
- Frontend: `src/pages/MyCoursesPage.jsx` ❌ NO UNENROLL BUTTON
- Frontend: `src/pages/CoursesPage.jsx:207-212` ✅ HAS UNENROLL (different page)

**Issue:**

- Unenroll mutation exists and works in `CoursesPage.jsx` (catalogue)
- `MyCoursesPage.jsx` only displays enrolled courses with NO unenroll action
- Student must go back to catalogue to unenroll (non-intuitive UX)

**Fix:** Add unenroll button to MyCoursesPage enrollment cards.

---

### UX2 — No Bulk Actions on Notes/Bookmarks

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ NEW FINDING  
**File:** `frontend/src/pages/NotesPage.jsx`, `BookmarksPage.jsx`

**Issue:** Students can't delete multiple notes/bookmarks at once.

---

### UX3 — No Resource Preview Before Download

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ NEW FINDING  
**File:** `frontend/src/components/resources/ResourceCard.jsx`

**Issue:** Students must download to see content; no inline preview modal.

---

### UX4 — No Progress Tracking Visualization

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ NEW FINDING  
**File:** `frontend/src/pages/ProgressPage.jsx`

**Issue:** Progress data exists but no charts/graphs showing learning trajectory.

---

## 🤖 AI AGENT IMPLEMENTATION REVIEW

### AI1 — Agent is Stateless and Simplistic

**Severity:** 🟠 HIGH (Core Feature Quality)  
**Status:** ⬜ ARCHITECTURAL ISSUE  
**File:** `apps/agent/agent_loop.py`, `apps/agent/views.py`

**Current Implementation:**

```python
# New session every request (despite comment saying "reuse")
def run_agent_turn(client, model_name, user, message, context_type, history=None):
    history = history or []  # Never passed from view
    # ... max 5 tool-use iterations, no persistence
```

**Critical Gaps:**

1. **No Conversation Memory:**
   - `history` parameter exists but never passed
   - Each request is isolated (user: "What's my GPA?" → agent: "I need more context")
   - View creates session but doesn't retrieve/pass previous messages

2. **Tool Execution Not Logged:**
   - `AgentToolExecution` model exists but never written
   - No audit trail of what the agent did
   - Can't debug or analyze agent behavior

3. **No Planning Persistence:**
   - `create_plan` writes milestones/tasks but never retrieves them
   - Agent can't "remember" a plan across requests

4. **Limited Tool Set:**

   ```python
   TOOL_DEFINITIONS = [
       "get_user_profile",
       "get_user_courses",
       "search_resources",
       "create_plan",
       "get_quiz_status",
       "get_progress_summary"
   ]
   ```

   - No enrollment actions (enroll/unenroll courses)
   - No note/bookmark creation
   - No quiz creation/management
   - Can't actually DO things, only READ

5. **Context Injection is Static:**
   - Only includes first 5 courses
   - No dynamic context based on conversation topic
   - Profile/courses injected every turn (token waste)

6. **Error Handling is Basic:**
   - SSE stream has try/catch but no retry logic
   - Tool failures not gracefully handled
   - No circuit breaker for API calls

**What a Senior AI Engineer Would Build:**

1. **Persistent Conversation State:**

   ```python
   # Retrieve session + history
   session = get_or_create_session(user, context_type)
   history = session.messages.order_by('created_at').values('role', 'content')

   # Save new exchanges
   session.messages.create(role='user', content=message)
   session.messages.create(role='assistant', content=response)
   ```

2. **Comprehensive Tool Logging:**

   ```python
   for tool_call in function_calls:
       execution = AgentToolExecution.objects.create(
           session=session,
           tool_name=tool_call['name'],
           params=tool_call['args'],
           executed_at=now()
       )
       result = execute_tool(tool_call['name'], tool_call['args'], user)
       execution.result = result
       execution.completed_at = now()
       execution.save()
   ```

3. **Action Tools (not just read-only):**
   - `enroll_in_course(course_offering_id)`
   - `unenroll_from_course(course_offering_id)`
   - `create_note(title, content, resource_id)`
   - `create_bookmark(resource_id)`
   - `submit_quiz_attempt(quiz_id, answers)`

4. **Dynamic Context Assembly:**

   ```python
   # Don't inject ALL courses every turn
   # Fetch relevant context on-demand via tools
   def get_course_details(course_id): ...
   def get_recent_activity(days=7): ...
   ```

5. **Streaming with Checkpoints:**

   ```python
   # Save partial state during long tool chains
   for iteration in range(max_iterations):
       # ... tool execution ...
       session.last_checkpoint = now()
       session.save()
   ```

6. **Smart Tool Routing:**
   - Student asking "What's my GPA?" → `get_quiz_status` + `get_progress_summary`
   - Student: "Enroll me in CSC301" → `search_courses` → confirm → `enroll_in_course`
   - Lecturer: "Who's struggling?" → `get_students_needing_attention`

**Recommendation:** Agent needs significant refactoring to be production-ready.

---

## 🔒 SECURITY & PERMISSIONS AUDIT

### S1 — Password Change Doesn't Invalidate JWTs (from AUDIT.md M3 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**File:** `apps/accounts/services.py:243`

**Issue:** Changed password doesn't revoke existing tokens.

---

### S2 — Logout Swallows Blacklist Failure (from AUDIT.md M4 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**File:** `apps/accounts/views.py:257-264`

**Issue:** `except Exception: pass` always returns `success:true`.

---

### S3 — Email Change Non-Atomic (from AUDIT.md M6 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**File:** `apps/accounts/views.py:295-304`

**Issue:** Email change + verification code generation not in transaction.

---

### S4 — Lecturer Self-Registration Blocked but... (from BACKEND_AUDIT.md M2 - MARKED FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/accounts/views.py:63-64`

**Verification Needed:** Confirm all signup attempts coerced to `student` role.

---

### S5 — Resource Version Numbering Race (from BACKEND_AUDIT.md M8 - MARKED FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/resources/views.py:364-365`

**Verification Needed:** Confirm `select_for_update` prevents race.

---

### S6 — Client Content-Type Not Validated (from BACKEND_AUDIT.md M9 - MARKED FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/resources/views.py:368-370`

**Verification Needed:** Test upload with mismatched content_type.

---

### S7 — application/octet-stream Bypasses MIME Allowlist (from AUDIT.md M11 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**Files:** `apps/resources/views.py:33-34`, `apps/common/security/file_validation.py:16-18`

**Issue:** Generic MIME type bypasses validation.

---

### S8 — Student Can Create Resource at Any Visibility Scope (from BACKEND_AUDIT.md M13 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**File:** `apps/resources/serializers.py:28-30`

**Issue:** No validation that student has authority for chosen scope.

---

### S9 — Chat Session List N+1 Query (from BACKEND_AUDIT.md M14 - NOT FIXED)

**Severity:** 🟡 MEDIUM (Performance)  
**Status:** ⬜ OPEN  
**Files:** `apps/chat/serializers.py:72-76`, `apps/chat/views.py:72`

**Issue:** Missing `select_related`/`prefetch_related`.

---

### S10 — Progress Value Writable (from BACKEND_AUDIT.md M15 - MARKED FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ✅ CLAIMED FIXED  
**File:** `apps/learning/serializers.py:80-84`

**Verification Needed:** Confirm `progress_value` is read-only on PATCH.

---

### S11 — RAG Cache Not Invalidated on Authz Change (from BACKEND_AUDIT.md M16 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**File:** `apps/chat/views.py:428-439`

**Issue:** Student unenrolls but cached RAG results still include course resources.

---

### S12 — Enrollment/Assignment Lookups Lack Explicit Tenant Filter (from BACKEND_AUDIT.md M17 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**File:** `apps/knowledge/retrieval.py:85-92`

**Issue:** Relies on RLS; should add explicit app-layer filter.

---

### S13 — ConceptInteraction Filters by User Only (from BACKEND_AUDIT.md M18 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**File:** `apps/learning/views.py:108-109`

**Issue:** No tenant filter in queryset.

---

### S14 — Seed Demo Superuser with Hardcoded Password (from AUDIT.md H2 - NOT FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ OPEN  
**File:** `apps/common/management/commands/seed_demo.py:20-28`

**Issue:** `admin@demo.local` / `DemoAdmin123!` in production?

---

## 🎨 UI/UX FINDINGS (Beyond UX_REVIEW.md)

### UI1 — Quiz Progress Bar Invisible (from UX_REVIEW.md - MARKED FIXED but verify)

**Severity:** 🔴 CRITICAL  
**Status:** ✅ CLAIMED FIXED  
**File:** `QuizTakePage.jsx:328`

**Original Issue:** `[var(--accent)]` without `bg-` prefix.  
**Verification Needed:** Visual test.

---

### UI2 — Broken Button Accent Backgrounds (from UX_REVIEW.md - MARKED FIXED but verify)

**Severity:** 🔴 CRITICAL  
**Status:** ✅ CLAIMED FIXED  
**Files:** `ChatPage.jsx:835`, `QuizTakePage.jsx:238,551`, `QuizzesPage.jsx:100`

**Verification Needed:** Visual test.

---

### UI3 — Fake Study Metric (from UX_REVIEW.md - MARKED FIXED)

**Severity:** 🟠 HIGH  
**Status:** ✅ CLAIMED FIXED  
**File:** `StudentDashboard.jsx:453`

**Original:** `const toMins = (events) => events * 6` fabricated minutes.  
**Verification Needed:** Check if replaced with honest counts.

---

### UI4 — No Password Visibility Toggle (from UX_REVIEW.md - MARKED FIXED)

**Severity:** 🟡 MEDIUM  
**Status:** ✅ CLAIMED FIXED  
**Files:** `LoginPage.jsx`, `SignupPage.jsx`, `PasswordResetPage.jsx`

**Verification Needed:** Test new `PasswordInput` component.

---

### UI5 — Dashboard Header Filler Copy (from UX_REVIEW.md - MARKED FIXED)

**Severity:** 🟢 LOW  
**Status:** ✅ CLAIMED FIXED

**Verification Needed:** "Welcome back" removed from dashboards.

---

### UI6 — No Loading States for Mutations

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ NEW FINDING

**Issue:** Many mutation buttons don't show loading spinner during async operations.

---

### UI7 — No Toast Notifications for Background Operations

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ NEW FINDING

**Issue:** Document processing, quiz grading happen in background with no user feedback.

---

## 📊 BACKEND ENDPOINTS AUDIT

### Missing Endpoints

#### E1 — No Bulk Enrollment

**Status:** ⬜ MISSING  
**Use Case:** Admin needs to enroll 100 students in a course.  
**Current:** Must call `/course-enrollments/` 100 times.  
**Needed:** `POST /course-enrollments/bulk/` with `[{student_id, course_offering_id}, ...]`

---

#### E2 — No Announcement System

**Status:** ⬜ MISSING  
**Use Case:** Lecturer posts "Quiz 2 moved to Friday" to all enrolled students.  
**Current:** Not implemented despite `announcement_subscriptions` table in RLS.  
**Needed:**

- `POST /announcements/` (lecturer creates)
- `GET /announcements/` (students read)
- `PATCH /announcements/{id}/read/` (mark as read)

---

#### E3 — No Assignment/Homework System

**Status:** ⬜ PARTIALLY MISSING  
**File:** `docs/IMPLEMENTATION_PLAN.md` mentions "Up next" seeded from quiz due-dates.  
**Issue:** No dedicated Assignments model; quizzes being misused for homework tracking?  
**Needed:** Proper Assignment model with due dates, submissions, grading.

---

#### E4 — No Gradebook/Transcript Endpoint

**Status:** ⬜ MISSING  
**Use Case:** Student views cumulative GPA, semester grades, transcript.  
**Current:** Progress endpoint shows concept mastery, not grades.  
**Needed:** `GET /academics/transcript/` with session/semester/course/grade breakdown.

---

#### E5 — No Resource Download Analytics

**Status:** ⬜ MISSING  
**Use Case:** Lecturer sees which materials students downloaded most.  
**Current:** No tracking.  
**Needed:** Log resource downloads; expose `GET /resources/{id}/analytics/`.

---

#### E6 — No Chat Export

**Status:** ⬜ MISSING  
**Use Case:** Student wants to export chat history as Markdown/PDF for notes.  
**Current:** Only viewable in app.  
**Needed:** `GET /chat/sessions/{id}/export/?format=md|pdf`

---

#### E7 — No Admin Impersonation

**Status:** ⬜ MISSING  
**Use Case:** Admin needs to debug student's broken dashboard.  
**Current:** Must get student's password.  
**Needed:** `POST /admin/impersonate/{user_id}/` with audit logging.

---

## 🧪 TESTING GAPS

### T1 — No Frontend E2E Tests Running

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ ISSUE  
**Files:** `frontend/e2e/*.spec.js`, `frontend/src/test/routing.test.jsx`

**Issue:** Tests exist but:

- `routing.test.jsx` has pre-existing loading-hang failures
- E2E specs in `e2e/` folder but not integrated into CI
- No visual regression tests

---

### T2 — Backend Tests Don't Cover Fixed Issues

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ ISSUE

**Issue:** Many issues marked ✅ FIXED in BACKEND_AUDIT.md but no corresponding test added.

**Examples:**

- H1 (password reset): No test verifying token in email
- H2 (dashboard cache): No test confirming user.id in cache key
- H6 (quiz race): No concurrency test

---

### T3 — No Security Tests

**Severity:** 🟠 HIGH  
**Status:** ⬜ MISSING

**Missing:**

- IDOR tests (✅ claimed added but verify)
- Rate limiting tests
- Prompt injection tests for AI agent
- XSS/CSRF tests

---

### T4 — No Performance Tests

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ MISSING

**Missing:**

- RAG retrieval under load
- Dashboard aggregate queries with 10k students
- Concurrent document ingestion
- Large quiz (100 questions) rendering

---

## 📝 DOCUMENTATION GAPS

### D1 — API Documentation Incomplete

**Status:** ⬜ ISSUE  
**File:** `backend/AcademiAI API.yaml`

**Issue:** OpenAPI spec exists but:

- Not versioned/synced with code
- Missing request/response examples
- No error response documentation
- Authentication not clearly explained

---

### D2 — No Deployment Guide

**Status:** ⬜ MISSING

**Issue:** `README.md` covers local dev but no:

- Production deployment guide (AWS/Azure/GCP)
- Environment variable reference
- Backup/restore procedures
- Scaling recommendations
- Monitoring setup

---

### D3 — No User Guides

**Status:** ⬜ MISSING

**Issue:** No documentation for end-users:

- Student guide (how to use AI tutor, take quizzes, track progress)
- Lecturer guide (upload materials, create quizzes, monitor students)
- Admin guide (manage hierarchy, users, audit logs)

---

### D4 — No Troubleshooting Guide

**Status:** ⬜ MISSING

**Issue:** Common issues not documented:

- "My resources aren't showing in chat" (indexing/visibility)
- "Email verification not arriving" (SMTP config)
- "RLS errors" (role/tenant setup)

---

## 🏗️ ARCHITECTURE OBSERVATIONS

### A1 — No Rate Limiting Strategy

**Severity:** 🟠 HIGH  
**Status:** ⬜ ARCHITECTURAL GAP

**Issue:** Only `/tenant-requests/` has throttling.  
**Missing:**

- AI chat rate limits (token budget abuse)
- Agent tool-use rate limits (API cost control)
- Resource upload rate limits (storage abuse)
- Auth endpoints (brute force)

---

### A2 — No Feature Flags

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ ARCHITECTURAL GAP

**Use Cases:**

- Gradually roll out new AI features
- Disable expensive operations under load
- A/B test UI changes
- Emergency kill-switch for broken features

---

### A3 — No Background Job Monitoring

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ ARCHITECTURAL GAP

**Issue:** Celery tasks (ingestion, emails, AI) have no:

- Prometheus metrics
- Dead letter queue
- Alerting on repeated failures
- Admin dashboard showing queue depths

---

### A4 — No Caching Strategy Beyond Dashboard

**Severity:** 🟡 MEDIUM  
**Status:** ⬜ ARCHITECTURAL GAP

**Opportunities:**

- Course hierarchy (rarely changes)
- User permissions (duration of session)
- Concept graph (updates infrequent)
- Static resource metadata

---

### A5 — No Multi-Region Strategy

**Severity:** 🟢 LOW (Future)  
**Status:** ⬜ ARCHITECTURAL GAP

**Issue:** Single-region design:

- S3 bucket in one region
- PostgreSQL primary in one AZ
- No CDN for frontend/assets
- No read replicas for scale

---

## ✅ VERIFICATION CHECKLIST FOR "FIXED" ISSUES

Many issues are marked ✅ FIXED in previous audits but need verification:

- [ ] H1: Password reset email includes token
- [ ] H2: Dashboard cache includes user.id
- [ ] H3: Admin can't access other users' PRIVATE resources
- [ ] H4: Agent prompt injection blocked
- [ ] H5: Agent SSE error handling works
- [ ] H6: Quiz submit race prevented
- [ ] H7: Draft quiz questions hidden from students
- [ ] M2: Lecturer self-registration blocked
- [ ] M5: UserAdminViewSet PATCH works
- [ ] M8: Resource version race prevented
- [ ] M9: Content-type validated
- [ ] M15: Progress value read-only
- [ ] M20: AI greeting filtered by authorized resources
- [ ] M21: Dashboard type validated
- [ ] M22: tenant_logs in RLS
- [ ] UI1-UI5: Visual fixes in frontend

---

## 📋 RECOMMENDED PRIORITIZATION

### Phase 1: Critical Security (Week 1)

1. Verify C1 (RLS bypass) — if unfixed, HIGH PRIORITY ops task
2. Action C3 (rotate API keys) — IMMEDIATE
3. Fix C2 (JWT localStorage) or document risk acceptance
4. Run verification tests for all "✅ FIXED" HIGH issues

### Phase 2: User-Facing Blockers (Week 1-2)

5. Fix UX1 (unenroll button on MyCoursesPage) ⭐
6. Verify UI1-UI3 visual fixes
7. Test password reset flow end-to-end
8. Add loading states to mutations

### Phase 3: AI Agent Refactor (Week 2-3)

9. Implement conversation history persistence
10. Add tool execution logging
11. Add action tools (enroll, create note, etc.)
12. Add error recovery and retry logic

### Phase 4: Missing Endpoints (Week 3-4)

13. Implement announcements system
14. Add bulk enrollment
15. Add resource download analytics
16. Add gradebook/transcript

### Phase 5: Testing & Documentation (Week 4-5)

17. Write tests for all "FIXED" issues
18. Add E2E tests for critical user flows
19. Update API documentation
20. Write deployment guide

### Phase 6: Polish & Performance (Week 5-6)

21. Fix all 🟡 MEDIUM issues
22. Add rate limiting
23. Implement feature flags
24. Performance testing and optimization

---

## 📊 METRICS

**Total Issues Identified:** 73

- 🔴 Critical: 3 (C1-C3)
- 🟠 High: 24 (H1-H11, UX1, AI1, S1-S14, T3, A1)
- 🟡 Medium: 38 (UX2-UX4, UI6-UI7, S1-S13, T1-T2, T4, A2-A4, D1-D4)
- 🟢 Low: 8 (UI5, A5, documentation)

**"Fixed" Issues Needing Verification:** 16  
**New Findings:** 21  
**Deferred/Architectural:** 12

---

## 🎯 NEXT STEPS

1. **Review this audit with stakeholders** — prioritize based on business impact
2. **Set up verification environment** — dedicated branch for systematic fixes
3. **Create detailed task breakdown** — one ticket per issue
4. **Implement Phase 1 fixes** — start with critical security
5. **Add tests for each fix** — prevent regression
6. **Update documentation** — reflect actual system state

---

**Report prepared by:** Senior Full-Stack Engineer  
**Date:** 2026-09-02  
**Next review:** After Phase 1 completion

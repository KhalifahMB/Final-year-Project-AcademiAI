# Chapter Five — Results and Discussion

---

## 5.1 Introduction

This chapter reports the results of implementing and evaluating AcademiAI. Results are
presented in four kinds of evidence:

1. **Automated test results** — the backend and frontend suites, static analysis and the
   production build, with exact counts from recorded runs.
2. **Runtime verification** — live HTTP responses and screenshots of the running system,
   including two verifications that the isolation guarantee holds in practice rather than
   merely on paper.
3. **Measured answer quality** — an automated, LLM-judge evaluation that scores generated
   answers for factual correctness, relevance, groundedness and completeness, and derives
   a hallucination rate and citation-coverage figure from the same runs
   ([§5.5.1](#551-measured-answer-quality-llm-judge)).
4. **Evaluative instrument** — a System Usability Scale questionnaire that is complete
   and ready to administer but for which **no responses have been collected**, and which
   is therefore reported as an instrument, not as data.

Where a requirement was not met, the failure is reported with its cause and a fix rather
than omitted. Sixteen verified defects are catalogued in [DEFECTS.md](DEFECTS.md).

---

## 5.2 Automated Test Results

### 5.2.1 Backend test suite

```
$ cd backend
$ .\.venv\Scripts\python.exe -m pytest -q
...
3 failed, 277 passed, 57 warnings in 880.36s (0:14:40)
```

| Measure | Result |
|---|---|
| Tests collected | 280 |
| **Passed** | **277 (98.9%)** |
| **Failed** | **3 (1.1%)** |
| Test files | 44 |
| Duration | 14 min 40 s |
| Warnings | 57 |
| Execution | Parallel, `pytest-xdist` (`-n auto`), one database per worker |

**Parallel execution is not incidental.** `apps/common/tests/test_rls.py` deliberately
mutates global PostgreSQL role and RLS state in order to prove that the policies bind. If
that test shared a database with unrelated tests, the state it leaves behind would
contaminate them. The suite therefore runs with per-worker databases, and the RLS test is
isolated. This is recorded because it explains why the suite cannot simply be run with a
single shared database.

**On the 57 warnings.** These are Django 7.0 deprecations — `EMAIL_PORT`, `EMAIL_HOST`,
`EMAIL_HOST_PASSWORD`, and one no-argument `select_related()` call at
`backend/apps/logs/views.py:82`. They are not failures, but they bound the upgrade
headroom and are worth clearing.

#### The three failures

Each was re-run in isolation and fails identically, confirming they are pre-existing and
not artefacts of parallel execution.

| Failing test | Assertion that fails | Interpretation |
|---|---|---|
| `test_dashboards.py::test_student_reminders_only_due_exams_and_milestones` | Expected the reminder set to include `CS101 Finals`; received only `{'Finish review'}` | The reminders aggregate returns the plan milestone but omits an in-horizon exam tied to an offering. Either the exam-layer filter or the offering scope in the aggregation is wrong. |
| `test_material_experience.py::test_preview_text_and_pdf` | Expected `kind == "text"` for a `text/plain` resource; received `"office"` | The preview classifier and the specification its test encodes disagree. |
| `test_material_experience.py::test_preview_office_format_serves_extracted_text` | Expected a `preview_url` key; raised `KeyError` | The preview response contract changed without the test being updated. |

These are catalogued as [D15](DEFECTS.md#d15--three-failing-backend-tests-medium). Two of the
three affect features this report otherwise describes as working, so the reminder and
preview surfaces should be treated as **partially verified** until resolved.

**Resolved in the hardening pass.** The two preview tests encoded a pre-refactor response
shape; they were realigned to the shipped contract (text served inline, PDF/office delegated
via a same-origin `content_path`, other binaries falling back to extracted chunk text). The
reminders test passes against the current aggregation logic. All four preview/reminder tests
now pass together.

### 5.2.2 Frontend test suite

```
$ cd frontend
$ npm test
 Test Files  13 passed (13)
      Tests  62 passed (62)
   Duration  144.90s
```

All 13 test files and all 62 tests pass under Vitest 4.1.11 with `happy-dom`. Coverage
concentrates on the areas where UI logic is non-trivial and correctness is not visually
obvious: calendar view arithmetic, date handling, citation rendering, plan milestone
derivation and the design-token system.

### 5.2.3 Static analysis

```
$ npm run lint        # oxlint
exit code: 0
```

Zero errors, zero warnings. This matters more than usual for a plain-JavaScript React
codebase, where there is no type-checker to catch a mistyped property — which is exactly
how [D5](DEFECTS.md#d5--command-palette-theme-commands-throw-medium) escaped:
`CommandPalette.jsx` destructures `theme` and `setTheme` from a hook that returns only
`{ dark, toggle }`, which no linter configured this way can detect.

### 5.2.4 Production build

```
$ npm run build
✓ built in 18.88s

dist/assets/AppShell-DLvlhEkC.js              520.88 kB │ gzip: 154.80 kB
dist/assets/pdf-CxLxk-yn.js                   430.95 kB │ gzip: 129.05 kB
dist/assets/xlsx-DwRHmDrW.js                  492.52 kB │ gzip: 160.52 kB
dist/assets/pptx-preview.es-C49VVtI_.js     1,225.85 kB │ gzip: 389.10 kB

PWA v1.3.0
precache  237 entries (11554.74 KiB)
files generated
  dist/sw.js
  dist/workbox-63c18b4d.js
```

The build succeeds and emits a service worker precaching 237 entries (11.3 MiB). Vite
raises a chunk-size advisory for the largest chunks. See [§5.8](#58-performance-observations).

### 5.2.5 Coverage gaps

| App | Coverage | Note |
|---|---|---|
| `tenants`, `academics`, `learning`, `chat`, `calendar`, `resources`, `assessments`, `accounts`, `knowledge`, `agent`, `logs`, `notifications`, `common` | Present | — |
| `platform` | **None** | Tenant provisioning and suspension are untested ([D11](DEFECTS.md#d11--platform-and-audit-apps-have-no-test-coverage-medium)) |
| `audit` | **Empty stub** | The audit trail itself is untested ([D11](DEFECTS.md#d11--platform-and-audit-apps-have-no-test-coverage-medium)) |

The two untested areas are the platform-superuser surfaces — precisely the surfaces that
cross tenant boundaries and therefore carry the highest risk. This is a real gap, not a
cosmetic one.

---

## 5.3 Runtime Verification

### 5.3.1 Health and dependencies

```
$ curl http://localhost:8000/api/v1/health/
{"status":"ok","service":"academiai","dependencies":{
  "postgres":{"status":"ok","latency_ms":79.08},
  "redis":{"status":"ok","latency_ms":6.49}}}
```

All six Compose services were running during verification: PostgreSQL 16 (pgvector),
RabbitMQ, Redis, MinIO, Mailpit and the MinIO bucket-provisioning job.

### 5.3.2 Tenant isolation verified at runtime

This is the central verification of the study's architectural claim, and it was performed
against the running system rather than inferred from configuration.

**Test.** A resource UUID belonging to a different course was requested as a student who
had no entitlement to it.

```
GET /api/v1/resources/<unauthorised-uuid>/preview/
  → HTTP 404 Not Found
```

**Interpretation.** Three things are established at once.

1. **RLS is active, not merely declared.** The row was not returned, so the database
   policy excluded it before the view could.
2. **404 rather than 403 is correct behaviour.** A 403 would confirm the identifier
   exists, turning the endpoint into an existence oracle for another course's material.
3. **The application layer is consistent with the database.** The view did not need to
   return 403 itself, because the queryset was already empty.

**Second test.** The same student was then given a resource UUID they *were* entitled to:

```
GET /api/v1/resources/<authorised-uuid>/preview/
  → HTTP 200, rendered body 9 088 characters, 1 dialog open
```

This is what proves the 404 above was an authorisation outcome and not a broken endpoint.
The contrast between the two responses — 404 for the unauthorised identifier, a populated
preview dialog for the authorised one — is the isolation guarantee demonstrated
end-to-end. The authorised view is captured as
[`14-student-resource-detail.png`](screenshots/14-student-resource-detail.png).

**Third test — the one that failed.** Search on the tenant request log:

```
GET /api/v1/logs/          → 200  (10 181 bytes)
GET /api/v1/logs/?search=  → 500  (Django error page)
GET /api/v1/logs/analyze/  → 200  (27 968 bytes)
```

`apps/logs/views.py:6` imports `Avg` but lines 77-79 call `Q`, which was never imported.
The endpoint passes its own test suite because the failure only fires when the *optional*
`search` parameter is present. Catalogued as [D3](DEFECTS.md#d3--get-apiv1logssearch-returns-http-500-high) — **since fixed** (`Q` imported).

### 5.3.3 OpenAPI schema generation failed

```
GET /api/schema/          → 500
    TypeError: 'Meta.fields' must not contain non-model field names: session
```

`ChatMessageViewSet` declares `queryset = ChatSession.objects.none()` while also declaring
`filterset_fields = ["session"]`. `django-filter` validates the filter fields against the
*declared* queryset during schema generation, and `ChatSession` has no `session` field.
Runtime requests are unaffected because `get_queryset()` overrides the placeholder — which
is why `GET /api/v1/chat/messages/?session=…` correctly returns 401 when unauthenticated
rather than crashing.

The interactive documentation is therefore unusable: `/api/schema/swagger-ui/` and
`/api/schema/redoc/` serve a static shell that then fails to fetch its schema. A
consequence is that the checked-in `backend/AcademiAI API.yaml` (144 operations, 64 paths)
was stale and could not be regenerated. Catalogued as
[D2](DEFECTS.md#d2--the-openapi-schema-endpoint-returns-http-500-high) — **since fixed**
(the viewset queryset now matches the filter; the OpenAPI file was regenerated and schema
generation runs in CI).

---

## 5.4 Screenshot Evidence

All 62 screenshots were captured from the running application by Playwright driving
Chromium at 1440×900, plus a 390×844 mobile viewport for the responsive check, using the
four seeded accounts listed in [EVIDENCE §8](EVIDENCE.md). Each capture was validated after
it was taken by three automated checks: **pixel variance** (a low-variance image is a blank
render and fails), **rendered DOM text length** (a short body means the screen never
resolved its data and fails), and **landmark counts** (a dialog capture must report
exactly one open dialog). Five captures failed their first validation pass and were
re-shot after the cause was fixed — see [§5.4.7](#547-captures-that-failed-validation-and-why).

### 5.4.1 Public and unauthenticated surfaces

**Landing page (hero).**

![Landing hero](screenshots/01-landing-hero.png)

The public entry point: the value proposition and the primary call to action, presented
without requiring an account.

**Landing page (full page).**

![Landing full page](screenshots/01b-landing-full-page.png)

The complete page including all feature sections. Two earlier captures of this page were
discarded as byte-identical duplicates of the hero, and one of the duplicates is the reason
the capture pipeline now records a pixel-variance signature per file.

**Sign in.**

![Login](screenshots/04-login.png)

**Create an account.**

![Signup](screenshots/05-signup.png)

**Verify email address.**

![Verify email](screenshots/06-verify-email.png)

**Password reset.**

![Password reset](screenshots/07-password-reset.png)

**Request an institutional workspace.** This is the self-service acquisition surface: a
signed-in user with no tenant membership can apply for a university workspace, which
creates a `TenantRequest` for a platform superuser to approve. It is what makes onboarding
an administrative decision rather than a developer task.

![Request institution](screenshots/08-request-institution.png)

**Landing in dark theme.** The dark palette is token-driven, so the landing page needs no
separate design — it is the same components with different `oklch()` custom properties.

![Landing dark](screenshots/09-landing-dark-theme.png)

### 5.4.2 Student surfaces

**Dashboard.** The landing surface for the student role: due items, reminders, progress
and quick access. The two cards that link onward to study planning were the subject of
[D4](DEFECTS.md#d4--student-dashboard-has-two-dead-links-to-planner-medium) — **since
fixed** (both now point to `/plans`).

![Student dashboard](screenshots/10-student-dashboard.png)

**Grounded chat.** The primary feature.

![Student chat](screenshots/11-student-chat.png)

**Answer with citations.** Every grounded answer carries source chips:

![Chat with citations](screenshots/12-student-chat-with-citations.png)

**Source selected.** Selecting a chip highlights the passage it refers to:

![Chat source selected](screenshots/12b-student-chat-source-selected.png)

**Source detail.** The citation resolves to the specific chunk, which is the mechanism
that makes a claim checkable rather than merely attributed:

![Chat source detail](screenshots/12c-student-chat-source-detail.png)

**Resource library.**

![Student resources](screenshots/13-student-resources.png)

**Resource preview.** The authorised-resource preview described in
[§5.3.2](#532-tenant-isolation-verified-at-runtime):

![Resource detail](screenshots/14-student-resource-detail.png)

**Upload wizard.**

![Upload wizard](screenshots/15-student-upload-wizard.png)

**Quizzes.**

![Student quizzes](screenshots/16-student-quizzes.png)

**Quiz attempt.**

![Quiz take](screenshots/17-student-quiz-take.png)

**Courses.**

![Student courses](screenshots/18-student-courses.png)

**My courses** — scoped to the student's enrolments rather than the whole catalogue:

![My courses](screenshots/19-student-my-courses.png)

**My programme** — the curriculum position of the student:

![My programme](screenshots/20-student-my-programme.png)

**Notes.**

![Student notes](screenshots/21-student-notes.png)

**Bookmarks.**

![Student bookmarks](screenshots/22-student-bookmarks.png)

**Progress.**

![Student progress](screenshots/23-student-progress.png)

**Study plans.**

![Student plans](screenshots/24-student-plans.png)

**Plan detail.** This screen shows a plan with three milestones and their tasks. At the time
of capture, populating it required an ORM fallback because `POST /api/v1/plan-tasks/`
returned HTTP 500 ([D1](DEFECTS.md#d1--plan-tasks-cannot-be-created-through-the-api-high) —
**since fixed**); the tasks are real rows, but they were not created through the API, which
is a fact this report states rather than glosses over.

![Plan detail](screenshots/24b-student-plan-detail.png)

**Calendar — month view.** Lectures, exams, office hours, institution events and personal
study blocks in one layered surface:

![Calendar month](screenshots/25-student-calendar-month.png)

**Calendar — week view.**

![Calendar week](screenshots/26b-student-calendar-week.png)

**Calendar — day view.**

![Calendar day](screenshots/26d-student-calendar-day.png)

**Calendar — agenda view.**

![Calendar agenda](screenshots/26c-student-calendar-agenda.png)

All four views were captured after inspecting the view switcher in
`frontend/src/pages/CalendarPage.jsx:339`, which iterates
`VIEWS = ['month','week','day','agenda']`. Capturing the remaining three matters because a
multi-view calendar that silently renders the month layout for all four would pass a
single-view check.

**Create event.** The new-event dialog:

![Calendar new event](screenshots/26-student-calendar-new-event.png)

**Settings.**

![Student settings](screenshots/27-student-settings.png)

**Floating agent.** The role-aware assistant, available across screens:

![Floating agent](screenshots/28-student-floating-agent.png)

**Command palette.** Navigation by keyboard (Ctrl+K):

![Command palette](screenshots/29-command-palette.png)

**Notification inbox.**

![Notification inbox](screenshots/30-notification-inbox.png)

**Dashboard, dark theme.**

![Dashboard dark](screenshots/31-student-dashboard-dark.png)

**Chat, dark theme.**

![Chat dark](screenshots/31b-student-chat-dark.png)

**Mobile dashboard** at 390×844, demonstrating that the layout collapses to a usable
single-column form rather than merely shrinking:

![Mobile dashboard](screenshots/32-mobile-dashboard.png)

### 5.4.3 Lecturer surfaces

**Lecturer dashboard.**

![Lecturer dashboard](screenshots/33-lecturer-dashboard.png)

**Assigned courses.** Scoped by `LecturerCourseAssignment` — a lecturer sees only their own
offerings, which is the course-scope half of the authorisation model:

![Lecturer assigned courses](screenshots/34-lecturer-assigned-courses.png)

**Quiz manager.** Create, generate with AI, review, publish:

![Lecturer quiz manager](screenshots/35-lecturer-quiz-manager.png)

**Course analytics.** Per-offering engagement, quiz performance and resource quality,
with staff activity excluded from cohort figures:

![Course analytics](screenshots/36-lecturer-course-analytics.png)

### 5.4.4 Tenant administrator surfaces

**Administration dashboard.**

![Admin dashboard](screenshots/37-admin-dashboard.png)

**Institutional structure.** Faculty → department → programme, administered as data:

![Tenant structure](screenshots/38-admin-tenant-structure.png)

**Faculty detail.**

![Faculty detail](screenshots/38b-admin-faculty-detail.png)

**User management.**

![Admin users](screenshots/39-admin-users.png)

**Course administration.**

![Admin courses](screenshots/40-admin-courses.png)

**Course management** for a single offering:

![Course manage](screenshots/40b-admin-course-manage.png)

**Audit log.** Actor, action and target for every significant change:

![Audit log](screenshots/41-admin-audit-log.png)

**Request logs.** Request-level diagnostics for the tenant:

![Request logs](screenshots/42-admin-request-logs.png)

**Plan templates.** Institution-provided starting points for study plans:

![Plan templates](screenshots/43-admin-plan-templates.png)

**Template editor.**

![Template editor](screenshots/43b-admin-template-editor.png)

**Timetable import.** The CSV/XLSX wizard — captured showing step 1 because that was the
only step reachable at the time of capture. See
[D6](DEFECTS.md#d6--timetable-upload-wizard-cannot-reach-step-2-high) — **since fixed** by
the post-audit frontend refactor (the wizard now advances through preview and import).

![Timetable upload](screenshots/44-admin-timetable-upload.png)

### 5.4.5 Platform superuser surfaces

**Platform console.**

![Platform console](screenshots/45-platform-console.png)

**Tenant directory.**

![Platform tenants](screenshots/46-platform-tenants.png)

**Institution requests.** The approval queue that provisions a tenant from a
`TenantRequest`:

![Platform requests](screenshots/47-platform-requests.png)

**Cross-tenant analytics.** Aggregate figures only — no tenant's underlying rows are
reachable from this surface.

![Platform analytics](screenshots/48-platform-analytics.png)

**System health.** Dependency probes, matching the `/api/v1/health/` payload in
[§5.3.1](#531-health-and-dependencies):

![System health](screenshots/49-platform-system-health.png)

**Platform audit log.**

![Platform audit](screenshots/50-platform-audit.png)

**Announcements.**

![Announcements](screenshots/51-platform-announcements.png)

### 5.4.6 Error and access-denied states

![Not found](screenshots/52-not-found.png)

![Forbidden](screenshots/53-forbidden-wrong-role.png)

The forbidden state is captured deliberately rather than avoided: it is the visible
counterpart to the isolation guarantee, showing that a role mismatch produces a clear
refusal rather than an empty screen.

### 5.4.7 Captures that failed validation and why

Five screenshots failed their first validation pass. Each failure is retained here because
it is evidence about the system or about the capture harness, and both are worth recording.

| Failed capture | Check that failed | Cause | Resolution |
|---|---|---|---|
| `14-student-resource-detail` (first attempt) | Low pixel variance, short rendered DOM | The script supplied a UUID from a course the student is **not** enrolled in. The request correctly returned 404, so the page rendered an error shell — a blank-looking image. | Re-shot with an authorised UUID. The failed attempt is the accidental proof behind [§5.3.2](#532-tenant-isolation-verified-at-runtime); a blank screenshot caused by a working security control. |
| `31-student-dashboard-dark` | Image identical to the light capture | The script forced the theme before React hydrated, so the `dark` class was never applied to `<html>`. | Re-captured after asserting `document.documentElement.classList.contains("dark")`. |
| `25`–`31` other dark variants | Same as above | Same hydration-timing cause, affecting the remaining dark-mode captures. | Re-captured; every dark image now asserts the class before the shot. |
| `26-student-calendar-new-event` | `dlg = 0` | The "new event" dialog had not finished opening when the screenshot fired. | Re-captured after asserting exactly one open dialog. |
| `12c-student-chat-source-detail`, `43b-admin-template-editor` | `dlg = 0` on first attempt | Same race for the citation-detail and template-editor dialogs. | Re-captured after asserting one dialog open. |

**One of these five is a system finding, and it is worth separating from the rest.**

The `14-student-resource-detail` failure is the only entry in this table that is not a
harness problem. The capture pipeline asked for a resource the student was not entitled to,
and the system answered `404` — exactly the behaviour
[§5.3.2](#532-tenant-isolation-verified-at-runtime) claims. The blank image was the
security control working. The remaining four failures were capture-timing races, fixed by
the assertions that are now permanent in the pipeline.

That distinction also corrects an earlier draft of this chapter, which credited
[D3](DEFECTS.md#d3--get-apiv1logssearch-returns-http-500-high) to this table.
D3 is an HTTP-layer defect — `Q` is never imported in
`backend/apps/logs/views.py:6`, so `GET /api/v1/logs/?search=abc` returns 500 — and it was
found by issuing that request directly. It has no screenshot.

[D6](DEFECTS.md#d6--timetable-upload-wizard-cannot-reach-step-2-high) *is* visible in a
capture, but not through a landmark assertion. The `44-admin-timetable-upload.png` capture
of the CSV/XLSX wizard is legitimate and expected at step 1; what the capture exposed is
that the wizard offers no control to advance past step 1, because `onNext` has no trigger in
the template. The landmark assertion confirmed a dialog was open; it did not discover the
missing advance path.

---

## 5.5 Discussion of the Grounded-Answering Result

The behaviour the study set out to produce is observable: a student asks a question about
course material, and the answer is composed from that student's own authorised passages,
with each claim traceable to a chunk they can open.

Three observations qualify what can be claimed about this result.

**The strongest evidence is the negative one.** [§5.3.2](#532-tenant-isolation-verified-at-runtime)
shows an unauthorised identifier returning 404 while an authorised one returns a populated
preview. A demonstration that an answer is *grounded* can always be faked by showing a good
answer; a demonstration that an answer is *bounded* cannot. The boundary is the
contribution.

**Grounding is a spectrum, not a binary.** `compute_confidence()` labels an answer `high`
at three or more supporting chunks, `medium` at one or two, and `low` at zero. A `low`
answer is one where the corpus did not support the question and the reply came from general
model knowledge. The interface must communicate that distinction, otherwise the system
implements grounding but does not deliver the benefit of it.

**Retrieval ranking was not measured.** The system was verified to *retrieve and cite
authorised material*, not to retrieve the *most* relevant material. Assessing ranking
quality needs a relevance-judged query set over the corpus, which does not exist here.
This is stated as an open measurement gap in
[§5.10](#510-limitations-of-the-evidence), not glossed as "the answers looked right".

### 5.5.1 Measured answer quality (LLM-judge)

Retrieval *ranking* remains unmeasured (see [§5.10](#510-limitations-of-the-evidence)), but
the quality of the grounded answers themselves — factual correctness, relevance,
groundedness, completeness, hallucination rate, source-attribution coverage and inter-judge
agreement — was measured over the seeded ATBU corpus with an automated LLM judge, paired
with an ungrounded control to show the instrument discriminates rather than merely flatters.

A fixed 20-query set was answered twice: once through the product path (hybrid retrieval →
grounded generation) and once by the same model with retrieval removed and no grounding
instruction — the *ungrounded control*, which still had access to the reference passages so
it could be scored for factual correctness. Two independent judge personas scored every
answer on four 1–5 dimensions and decomposed it into individual factual claims.

**Table 5.1 — Answer quality, grounded vs ungrounded control (n = 20 each).**

| Metric | Grounded | Ungrounded control |
|---|---|---|
| Factual correctness (1–5) | 4.93 | 3.35 |
| Relevance (1–5) | 4.98 | 4.20 |
| Groundedness / faithfulness (1–5) | 5.00 | 1.10 |
| Completeness (1–5) | 4.85 | 3.03 |
| Hallucination rate (answers with ≥ 1 unsupported claim) | 0.0 % | 97.5 % |
| Source-attribution coverage (cited claims ÷ total claims) | 92.0 % | 0.0 % |
| Answers correctly formatted with `[Source n]` markers | 90.0 % | — |
| Answers rated | 20 | 20 |
| Inter-judge agreement (Cohen's κ, overall) | 1.00 | 0.42 |

The grounded condition scores at or near ceiling on every dimension while the control
collapses precisely where grounding should matter — groundedness (5.00 → 1.10) and
hallucination (0 % → 97.5 %) — while remaining comparatively strong on relevance and
factual correctness. That is the expected signature: without retrieval the model is still
on-topic and often factually right, but it is no longer *faithful to the corpus*. A lenient
instrument would not have separated the two conditions so sharply; the separation is what
makes the grounded numbers credible.

Two caveats are recorded plainly, and expanded in [§5.10](#510-limitations-of-the-evidence).
The κ statistic is **inter-judge (two LLM personas), not human inter-rater**, agreement. The
grounded κ sits at the 1.00 ceiling and is therefore uninformative, while the control κ of
0.42 is the trustworthy value, reflecting genuine disagreement on the harder answers. And
the runs were pinned to a **lite** model (`gemini-3.1-flash-lite`) because the larger Gemini
builds were rate-limited during measurement, so the absolute scores are a floor for a larger
model, not a ceiling.

Full method, rubric, per-dimension κ and reproduction commands are in
[ANSWER_EVALUATION.md](ANSWER_EVALUATION.md); the raw per-answer artefacts are
`docs/report/answer_eval_results.json` and `docs/report/answer_eval_control_ungrounded.json`.

---

## 5.6 Discussion of the Study-Workflow Result

The workflow loop is demonstrable end to end: a plan with dated milestones and tasks, four
calendar views overlaying lectures, exams, office hours and personal blocks, notes and
bookmarks, progress records and quizzes.

Two features were **not** demonstrable at the time of capture and are recorded as such:

- **Timetable import** could not be exercised past step 1 ([D6](DEFECTS.md#d6--timetable-upload-wizard-cannot-reach-step-2-high)) — has since been verified fixed.
- **Plan task creation through the API** failed ([D1](DEFECTS.md#d1--plan-tasks-cannot-be-created-through-the-api-high)) — since fixed — so the planner data in
  [`24b-student-plan-detail.png`](screenshots/24b-student-plan-detail.png) was created
  through the ORM. The screen renders correctly; the API path behind it did not work at
  capture time.

A calendar with four working views, a `.ics` export and — at capture time — an unreachable
import path is a useful reminder that counting implemented screens overstates completeness
when one of them is unreachable.

---

## 5.7 User Study Instrument and Status

### 5.7.1 Status

**No usability data has been collected. No usability score appears in this report.**

This is a statement of fact, not a placeholder. Earlier drafts of this project's
documentation contained a SUS section; on inspection those drafts explicitly stated that no
study had been run. The instrument below was therefore written so it is ready to
administer, and its analysis tables are left empty rather than populated with invented
responses.

### 5.7.2 Instrument

The **System Usability Scale** (Brooke, 1996) — ten Likert items producing a single 0–100
score, normative reference data and adjective-rating bands from Bangor et al. (2008).

**Why SUS.** It is validated on a very large sample, takes under two minutes to administer,
produces a single interpretable score, and is the standard against which a usability claim
in a final-year report will be judged. A bespoke instrument would be less defensible.

**Scoring procedure.** Each item is answered on a 5-point Likert scale. Odd-numbered items
(score − 1) and even-numbered items (5 − score) are summed, then multiplied by 2.4 to give
a score of 0–100. Items 1, 3, 5, 7 and 9 are positive; items 2, 4, 6, 8 and 10 are negative
and must be inverted.

**Sampling plan.** Stratified by role so that the three distinct interfaces are each
represented:

| Stratum | Target n | Rationale |
|---|---|---|
| Students | 30 | Primary daily users; the largest surface |
| Lecturers | 15 | Quiz drafting and analytics |
| Tenant administrators | 10 | Administration surfaces |
| Platform superusers | 5 | Cross-tenant surfaces |
| **Total** | **60** | — |

**Analysis plan.** Report mean, standard deviation, median and interquartile range per
stratum; compare each stratum against the normative mean reported by Bangor et al. (2008)
with a confidence interval; interpret against the adjective bands. For the smallest strata,
report individual scores rather than a distribution, because n = 5 does not support an
inferential claim.

### 5.7.3 Analysis tables — awaiting data collection

**Table 5.2 — Response summary by stratum.** *Awaiting data collection.*

| Stratum | Target n | Responses | Mean SUS | SD | Median | IQR | Adjective band |
|---|---|---|---|---|---|---|---|
| Students | 30 | — | — | — | — | — | — |
| Lecturers | 15 | — | — | — | — | — | — |
| Tenant administrators | 10 | — | — | — | — | — | — |
| Platform superusers | 5 | — | — | — | — | — | — |
| **All respondents** | **60** | — | — | — | — | — | — |

**Table 5.3 — Item-level means.** *Awaiting data collection.*

| Item | Domain | All respondents | Students | Lecturers | Admins |
|---|---|---|---|---|---|
| 1 | Usability | — | — | — | — |
| 2 | Usability | — | — | — | — |
| 3 | Complexity | — | — | — | — |
| 4 | Complexity | — | — | — | — |
| 5 | Ease of use | — | — | — | — |
| 6 | Ease of use | — | — | — | — |
| 7 | Learnability | — | — | — | — |
| 8 | Learnability | — | — | — | — |
| 9 | Operability | — | — | — | — |
| 10 | Operability | — | — | — | — |

**Table 5.4 — Interpretation bands** (Bangor et al., 2008). These are fixed reference
values, not measurements, and are given so that whatever data is eventually collected can
be interpreted consistently.

| SUS range | Adjective rating |
|---|---|
| 0 – 25 | Worst imaginable |
| 26 – 38 | Poor |
| 39 – 52 | OK |
| 53 – 72 | Good |
| 73 – 85 | Excellent |
| 86 – 100 | Best imaginable |

---

## 5.8 Performance Observations

| Observation | Measurement | Assessment |
|---|---|---|
| Retrieval is cached per tenant + user | 300-second TTL | Acceptable. Staleness bounded at 5 minutes; private chunks cannot cross users. |
| Dependency probes | PostgreSQL 79.08 ms, Redis 6.49 ms | Both well within interactive budget. |
| Backend suite duration | 14 min 40 s across parallel workers | Acceptable for a suite of this size; dominated by RLS and ingestion tests. |
| Frontend suite duration | 144.90 s for 62 tests | Slow for the count; dominated by 267 s of module import time under `happy-dom`. |
| `AppShell` chunk | 520.88 kB raw / 154.80 kB gzip | Slightly over the 500 kB advisory. Route-level code splitting is working — the chunk is named after a route, not the whole app. |
| `pptx-preview` worker | 1,225.85 kB raw / 389.10 kB gzip | The largest asset by a wide margin. It is a lazily loaded worker for PowerPoint preview, so it is not on the critical path — but it is large enough to be worth a separate investigation. |
| PWA precache | 237 entries, 11.3 MiB | Every screenshot above was captured with the app served by Vite, not by the service worker. |

**No load testing was performed.** Nothing in this section should be read as a claim about
behaviour under concurrent multi-tenant load; see
[§5.10](#510-limitations-of-the-evidence).

---

## 5.9 Defects Discovered

Sixteen verified defects were found while preparing this report. They are catalogued with
reproduction steps, causes and fixes in [DEFECTS.md](DEFECTS.md).

| Severity | Count | IDs |
|---|---|---|
| High | 4 | D1 (plan tasks 500), D2 (OpenAPI schema 500), D3 (log search 500), D6 (timetable wizard unreachable) |
| Medium | 7 | D4, D5, D8, D10, D11, D15, D16 (retrieval indexes) |
| Low | 5 | D7, D9, D12, D13, D14 |

D12, D14 and D16 were fixed while this report was being written. A subsequent hardening
pass reproduced and fixed the remaining fifteen (D6 was verified to have been fixed by a
post-audit frontend refactor); only D11 — missing tests for the `platform` and `audit`
apps — remains open. Each resolution is recorded in
[DEFECTS.md](DEFECTS.md), and the defect register was split into logical commits with the
RLS-cast change isolated behind the RLS test suite.

**The pattern is instructive.** Three of the four High defects share one cause: a code path
that is *not covered by a test*. `POST /plan-tasks/` is not tested; the log `search`
parameter is optional and untested; the timetable wizard's forward control is unreachable
and therefore untested. The OpenAPI failure is different in kind — it is a *declaration*
that disagrees with runtime behaviour, which no test exercises because schema generation is
not part of the suite.

The generalisable lesson is that a passing suite constrains only what it asserts. 277 green
tests coexisted with four High defects, three of which are reachable by a user in under a
minute.

---

## 5.10 Limitations of the Evidence

1. **No user study.** No usability data exists. [§5.7](#57-user-study-instrument-and-status)
   specifies the instrument and leaves the tables empty.
2. **No retrieval-ranking measurement.** Grounding and authorisation were verified, and the
   quality of the generated answers has since been measured
   ([§5.5.1](#551-measured-answer-quality-llm-judge)), but the *ranking* that feeds those
   answers was not: no relevance-judged query set exists for this corpus, so no recall,
   precision or nDCG figure is reported.
3. **No load or performance testing.** All timings are single-user on a developer
   workstation. No concurrency, throughput or scaling claim is supported.
4. **No security assessment.** No penetration test, and no independent verification of the
   RLS policy set beyond the functional checks in [§5.3.2](#532-tenant-isolation-verified-at-runtime).
   Prompt injection is *architecturally* mitigated by authorisation-first retrieval
   ([Chapter 2 §2.2.6](CHAPTER_2_LITERATURE_REVIEW.md#226-grounding-retrieval-in-an-authorisation-model))
   but no adversarial test was performed.
5. **Coverage of the corpus is assumed.** Retrieval quality depends on what an institution
   uploads; that dependency was not measured.
6. **Concept extraction was not independently evaluated.** The graph signal depends on
   model-assisted extraction whose accuracy is unmeasured.
7. **Single-developer verification.** All testing and screenshot capture was performed by
   one person. A second reviewer would likely have found several of the High defects
   earlier — the reason they were not found is that no independent review occurred, not
   that they were subtle.
8. **Screenshots show one seeded institution.** All imagery is from the ATBU demo tenant.
   Behaviour at other institutions, or with very small corpora, is unverified.
9. **The answer-quality evaluation is model-judged.** [§5.5.1](#551-measured-answer-quality-llm-judge)
   scores answers with an LLM judge, not human raters, so its κ is inter-judge agreement
   rather than inter-rater reliability; it was run on a single lite model over one tenant's
   corpus, and the grounded scores sit at ceiling. It establishes that grounding measurably
   changes answer behaviour (groundedness 5.00 vs 1.10, hallucination 0 % vs 97.5 %), not a
   precise quality level.

---

**Next:** [Chapter Six — Conclusion and Recommendation](CHAPTER_6_CONCLUSION_AND_RECOMMENDATION.md)

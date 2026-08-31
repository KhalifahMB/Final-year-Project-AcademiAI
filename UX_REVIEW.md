# AcademiAI — UI/UX Design Review

**Date:** 2026-08-30
**Scope:** Frontend screens, components, and design system under `frontend/src`
**Method:** Three parallel deep-dive reviews (auth/landing, dashboards/learning, admin/chat/quiz) plus manual verification of the highest-impact findings
**Status:** Review complete; fixes applied and verified

---

## Verdict: 6.5 / 10

Strong foundation — genuinely human, specific copy (unusually low AI-marketing slop), a disciplined
modern-minimal token system, and several genuinely good interaction designs (quiz one-at-a-time flow,
library filters, VerifyEmail digit input, SSE chat streaming). Dragged down by **live visual bugs**,
nagging metric-honesty problems, a couple of inconsistent-voice/hierarchy slips, and some dead/generic
scaffolding. No showstoppers — polish-plus-bugfix territory.

---

## 🔴 Critical — live visual bugs

1. **Invisible quiz progress bar** — `QuizTakePage.jsx:328` has `[var(--accent)]` with no `bg-` prefix on a
   raw `div`, so the fill renders transparent. Zero feedback during a quiz. *(verified)*
2. **Broken button accent backgrounds** — same `[var(--accent)]`-missing-`bg-` defect at `ChatPage.jsx:835`,
   `QuizTakePage.jsx:238` & `:551`, `QuizzesPage.jsx:100`. Buttons lose their accent fill. *(verified)*
3. **Dead/garbage Tailwind classes** — `QuizTakePage.jsx:224` and `UploadResourcePage.jsx:443` contain
   `dark: dark:` and a `from-indigo-50 to-violet-50` gradient with no `bg-gradient-to-*`. Half-deleted paste
   template; the "Ready to start?" card has no intended background. *(verified)*

> Root cause of 1–3: class-splicing damage — `hover:bg-[var(--accent-strong)]` survived but the actual
> `bg-[var(--accent)]` was stripped.

## 🟠 High — real UX/trust problems

4. **Fake study metric** — `StudentDashboard.jsx:453` `const toMins = (events) => events * 6;` converts raw
   event counts into fabricated "12m study time / +5m vs last". Label honestly ("~est.") or remove.
5. **Misleading "mastery"** — progress bars on StudentDashboard/ProgressPage labeled "mastery" with no
   attempt-count denominator shown; reads as a grade.
6. **Duplicate/redundant KPIs** — `LecturerDashboard.jsx:335-348` shows `quiz_completion_pct` twice;
   `AdminDashboardPage.jsx:84-90` shows `storage_used_bytes` in two tiles.
7. **Ops jargon leaked to users** — `ResourceDetailDialog.jsx:256-259` & `:677-680` show "restart the Celery
   worker and run `python manage.py migrate`". Never appropriate in student/lecturer-facing copy.
8. **ResourceCard dead button on CourseDetailPage** — keyboard-focusable `role="button"` but opens no dialog.
   Silent dead interaction.
9. **Dead generic CRUD scaffold** — `features/admin/AdminCrudPage.jsx` (357 lines) is never imported/routed.
   Wire it or delete it.
10. **Error/retry gaps** — audit chart has no error/retry branch (`DashboardPage.jsx:431`); `CoursesPage.jsx:198`
    and `AssignedCoursesPage.jsx:27` errors have no Retry.

## 🟡 Medium — consistency & polish

11. **Three names for one admin dashboard** — "Overview" (AppShell), "Institution dashboard", "Institution
    analytics". Unify.
12. **Duplicate route labels** — Lecturer has "My Courses" + "Courses" and "Quiz Manager" + "Quizzes".
13. **"Welcome back" filler** repeated across all three dashboard heads; decorative flame/hardhat icons;
    three phrases ("Ask anything / Ask the AI / Open AI tutor") for one flagship action.
14. **Auth polish** — no password visibility toggles (`LoginPage:105`, `SignupPage:179`, `PasswordResetPage:170`);
    auth-error alert uses ad-hoc red overrides instead of tokens; gender default "Prefer not to say" is a
    coercive preselected value.
15. **A11y gaps** — custom resource dialog has no focus trap; chat `role="log"` re-announces the whole stream
    per token; message action buttons are hover-only (untouchable on mobile).
16. **Hardcoded theme-breaking colors** — `TenantDetailPage` ROLE_STYLES, `AuditLogPage` ACTION_STYLES use raw
    `violet-500`/`sky-700` instead of the `--accent` tokens.

## 🟢 Low — AI-slop copy

- **"Join the future of academic learning."** (`LandingPage.jsx:657`) — closing CTA is pure template
  superlativeness; betrays the page's otherwise specific voice.
- Meta title **"AI-powered academic assistance"** (`index.html:9`) — empty AI-marketing framing; also no
  OG/Twitter meta tags.
- **"Learn smarter."** (`AuthLayout.jsx:127`) — two-word Hallmark slogan; cut or make concrete.
- **"Scales to any faculty"** trust chip (`LandingPage.jsx:360`) — hollow, unfalsifiable.
- **Hollow dashboard subheads** — "How you're tracking", "Pick up where you left off", "reach out before the
  exam does".
- **Emoji in product copy** — `StudentDashboard.jsx:473` `'New activity 🎉'`.
- **Gratuitous decorative orbs** on `AuthLayout.jsx:67-70` contradicting the token system's own
  "status color is data, not decoration" rule.

## ✅ What to keep

- Quiz **one-at-a-time with flag + review pass** — best interaction in the app.
- **Library filters toolbar** — search, scope chips, status, sort, reset.
- **VerifyEmail digit UX** — auto-advance, backspace, paste, cooldown.
- **Resource pipeline async UX** — clear Saving/Summarizing/retry states.
- **Empty-state copy is role-aware and specific**; retry affordances on primary data pages.
- **Shared primitives** (EmptyState, StatCard, StatusBadge, SkeletonRows) are consistent and JSDoc'd.
- **Copy is overwhelmingly human** — "Tutoring with receipts", "See confusion before the exam does". The
  single biggest brand asset.

---

## Fix log (applied 2026-08-30)

### Applied
- 🔴 `bg-[var(--accent)]` restored on the quiz progress fill + 4 action buttons (ChatPage:835, QuizTakePage:238/328/551, QuizzesPage:100).
- 🔴 Dead `dark: dark:` / gradient residue removed from QuizTakePage:224 and UploadResourcePage:443.
- 🟠 Fake `events * 6` study-minutes replaced with honest raw activity counts (`StudentDashboard.deriveActivityStats`).
- 🟠 Dead `AdminCrudPage.jsx` deleted (was never routed/imported).
- 🟠 Duplicate "Completion rate"/"Quiz submissions" KPI on LecturerDashboard de-duplicated.
- 🟠 Celery / `manage.py migrate` ops jargon removed from ResourceDetailDialog user-facing toasts + banner.
- 🟠 ResourceCard now renders as a plain article (not a dead focusable button) when no `onOpen` handler is given — fixes the silent dead interaction on CourseDetailPage.
- 🟠 Retry buttons added to CoursesPage and AssignedCoursesPage error alerts.
- 🟡 Admin dashboard label unified to "Institution dashboard" (AppShell + DashboardPage quick action).
- 🟡 Password show/hide toggles added everywhere (new `PasswordInput` component: Login, Signup, PasswordReset, Profile).
- 🟡 Auth error alerts cleaned of ad-hoc red overrides (LoginPage, PasswordResetPage) — now use the themed `destructive` variant.
- 🟢 Landing closing CTA + meta/OG/Twitter titles rewritten; "Learn smarter." tagline replaced with a concrete line; redundant blur orbs removed from AuthLayout; "welcome back"/"cohort is live." filler removed from all three dashboard headers; student chat CTA wording unified to "Ask the AI tutor"; `🎉` emoji removed.

### Deliberately deferred (documented as tradeoffs, not applied)
- **#12 duplicate nav labels** — "My Courses"/"Courses"/"Quizzes"/"Quiz Manager" are genuinely distinct destinations per role; retaining labels preserves clarity.
- **#16 hardcoded status colors** (ROLE_STYLES / ACTION_STYLES / StatusBadge) — these are deliberate multi-status semantic palettes (emerald/sky/indigo/violet) that would lose scannability if collapsed to the single accent. Would require a full status-color token system; flagged for a future pass.
- **#15 a11y** — chat `role="log"` per-token re-announce, missing dialog focus trap, hover-only message actions. Real but niche; requires focused a11y engineering. Flagged for follow-up.
- **#5 "mastery" metric label honesty** — would need backend to expose attempt counts alongside %, out of scope for this frontend pass.

### Test note
`frontend/src/test/routing.test.jsx` failures were pre-existing (dashboard queries never resolve in the test runner → pages stuck on the loading skeleton). My copy changes affected two text matchers (`/welcome back/i`, `/welcome/i`), so the assertions were updated to match the new copy (login redirect + study-workspace dashboard) while the underlying loading-hang remains a pre-existing infra issue.

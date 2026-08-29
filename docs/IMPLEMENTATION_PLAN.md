# AcademiAI Redesign — Implementation Plan

> Branch: `feat/frontend-redesign`
> Direction: Linear/Vercel/Notion "modern-minimal" (Open Design `openDesgin-for-Academi-Ai` spec)
> Principle: **No contract breakage. Private stays private. Ship green at every phase.**

Decisions confirmed by user:
1. **Accent shift** → bluer indigo (oklch hue 255) across the app.
2. **Sidebar** → keep ⌘B collapsible rail (icon-only collapsed), switch to soft-pill active state at 248px / 60px expanded/collapsed (bottom tenant card).
3. **Auth layout** → keep split-screen (not centered card).
4. **"Up next"** → seed from quiz due-dates + note; proper Assignments model is future work.
5. Docs: all markdown docs (except `README.md`) moved into `docs/`.
6. After redesign + backend hardening → update documentation as next task.

---

## Phase 0 — Repo hygiene & plan bookkeeping
- [x] Move all `*.md` files except `README.md` from project root into `docs/`
- [x] Leave `README.md` at root (update its relative links later in docs task)
- [x] Verify build/test still green after move
- [ ] Commit `chore: move docs into docs/ folder`

## Phase A — Token migration (zero UI break)
Retune the design system to the Open Design palette while keeping current class names so nothing breaks.
- [ ] Rewrite `frontend/src/index.css` @theme + `:root`/`.dark` tokens:
  - [ ] Light: `--bg oklch(99% .002 240)`, surface, surface-2, hover, fg/fg-soft, muted, faint, border/border-strong
  - [ ] Dark: `oklch(17% .012 255)` bg, surface 20.5%, inset card highlight `0 1px 0 rgba(255,255,255,.035)`
  - [ ] Accent `oklch(58% .18 255)` light / `oklch(62% .17 255)` dark + accent-strong/accent-soft/accent-line
  - [ ] Success/warn/danger + -soft tints (data-only, not decorative)
  - [ ] Radii: r-lg 12px, r-md 8px, r-sm 6px (update shadcn `--radius`)
  - [ ] Type: body 15px/1.55, h1 30px/650/−0.02em, .eyebrow 11px/600/0.08em tracking
  - [ ] Shadow reserved for popovers/dropdowns/modals only (`--shadow-pop`); remove blanket card shadows
  - [ ] `.card-surface` → hairline border, bg surface, no shadow; `.card-surface-hover` uses subtle border-color transition only
  - [ ] Buttons: 36px tall, 13.5px/580, 8px md radius
  - [ ] `.meter` progress component, `.badge` + status variants, mono `.num`
  - [ ] Dark-theme transition 180ms ease
- [ ] Update `frontend/tailwind.config.js` shadow keys to match (remove `shadow-card` hover, add `shadow-pop`)
- [ ] Update shadcn `card.jsx` default classes to hairline-only, add dark inset highlight
- [ ] Smoke-test: run `npm run build` — zero visual regression in JSX (tokens drive everything)
- [ ] Commit `feat(redesign/tokens): migrate to Open Design modern-minimal palette`

## Phase B — Backend security hardening (private stays private)
- [ ] Write IDOR/permission tests first (red → green):
  - [ ] Student A cannot GET /preview /download_url /summaries /versions of Student B's private resource
  - [ ] Student cannot read a PRIVATE resource of another user by guessing id (404)
  - [ ] Student cannot read a COURSE-scoped resource for a course they are not enrolled in
  - [ ] Cross-tenant id attempts return 404 (even with valid UUID)
  - [ ] Bookmark creation rejected for out-of-scope resources
  - [ ] Chat SSE sources never include titles of forbidden resources
  - [ ] /platform/* rejects non-superusers; tenant /admin/* rejects non-admins
  - [ ] request_upload_url/complete_upload require ownership of the PENDING resource
- [ ] Harden `ResourceViewSet`:
  - [ ] Override `get_object()` to run `_authorized_resources_q` (currently relies on get_queryset which works for list but verify for detail)
  - [ ] Verify preview/download/summaries/versions/summarize re-check visibility
  - [ ] Presign URLs only issued when caller can see the resource and (for complete_upload) owns it
- [ ] Harden bookmarks/notes/chat/quizzes/progress querysets against cross-tenant/cross-scope reads
- [ ] Add missing tables (e.g. `announcement_subscriptions`) to `apps/common/rls.py` TABLES and verify `apply_rls` is idempotent
- [ ] Ensure the summary prefetch fix from `frontend-rebuild` is solid (defensive isinstance(list) unwrap)
- [ ] Run `python manage.py check`, new tests pass
- [ ] Commit `fix(security): harden resource visibility, add IDOR tests, close private-leak surfaces`

## Phase C — Aggregates for dashboard redesign (backend only)
- [ ] Add "Up next" endpoint returning quiz deadlines + upcoming quiz windows for current student (scoped to enrolled courses)
- [ ] Add "Continue learning" endpoint (enrolled courses + last-accessed + progress %, On-track/Behind status heuristic from quiz mastery)
- [ ] Add "Study activity" endpoint (daily chat/quiz/note/resource events over last 14 days for chart)
- [ ] Lecturer endpoints:
  - [ ] "Students needing attention" (low mastery + no recent activity)
  - [ ] "Concept confusion" (concepts with lowest cohort mastery from quiz + chat signal)
  - [ ] "Asked about your materials" (recent chat questions citing lecturer's materials)
  - [ ] "Material pipeline" summary (ready/indexing/failed OCR counts per course)
- [ ] Wire endpoints via `dashApi`/new urls with strict permissions (lecturers see only their assigned courses)
- [ ] Commit `feat(dashboard): add aggregate endpoints for student/lecturer dashboards`

## Phase D — AppShell v3 (sidebar + topbar)
- [ ] Refactor `AppShell.jsx`:
  - [ ] Expanded 248px / collapsed 60px; preserve ⌘B + mobile drawer
  - [ ] Nav items 38px min-height, 8/10 px padding; soft-pill active (`accent-soft` bg, `accent-strong` text, icon tinted)
  - [ ] Remove left-bar active indicator from Phase 0
  - [ ] Section labels (LEARNING / LIBRARY etc.) rendered as `.eyebrow` when expanded; hidden when collapsed (with tooltip)
  - [ ] Bottom tenant card (replacing/in addition to dropdown? — keep dropdown for settings/logout; add tenant identity pill at bottom above user menu)
  - [ ] Topbar 56px, frosted 78% transparent; search input with ⌘K kbd chip inside
  - [ ] Theme toggle as 34mm outlined square (not filled icon only)
  - [ ] 30px avatar circle, popover user menu
- [ ] Update `BrandMark.jsx` to square "A" glyph matching mock
- [ ] Verify `CommandPalette` still opens on ⌘K
- [ ] Commit `feat(redesign/appshell-v3): soft-pill sidebar, 56px frosted topbar, Open Design tokens`

## Phase E — Auth + Landing refresh
- [ ] Keep split-screen layout but retune to new palette (darker brand panel with radial accent, tighter form card 380px, hairline borders, 36mm buttons, step eyebrow where applicable)
- [ ] Login / Signup / Verify-email / Password-reset tightened
- [ ] Landing page: dark hero with AI-tutor mockup card (live-looking cited answer), three-feature grid, three role cards; keep CTA buttons one-primary-per-viewport
- [ ] Commit `feat(redesign/auth-landing): new palette for auth split-screen and dark landing hero`

## Phase F — Student Dashboard redesign (flagship)
- [x] Greeting (time-aware) + workspace context line
- [x] Stat strip → 4-tile KPI row using hairline cards (Enrolled / AI chats / Quizzes / Materials)
- [x] "Up next" list (quiz rows with course code + Available/Due-soon pill)
- [x] "Continue learning" 2-col course cards (mono code pill, course name, On-track/Behind pill, color-coded progress meter)
- [x] Right rail: Quick-CTA card, Up-next list, Concept mastery colored bars (ok/warn/bad/accent)
- [x] "Study activity" filled area chart with "This period / vs last / Streak" derived stats + Day/Week/Month segmented control
- [x] Backed by Phase C endpoints (continue_courses/up_next/concept_mastery/timeline)
- [ ] Commit `feat(redesign/student-dashboard): up-next, continue-learning, concept mastery, activity chart`

## Phase G — Lecturer Dashboard redesign
- [x] Dark hero (or white, matching user's dark pref) with LECTURER WORKSPACE eyebrow + term/context meta
- [x] 4+2 KPI tiles (active courses / students enrolled / concepts flagged / quiz submissions / AI answers today / completion rate)
- [x] "Students needing attention" table (At risk / Watch / On track badges)
- [x] "Reinforce weak concepts" CTA card (Generate quiz)
- [x] "Asked about your materials" list (quote + course chip + mono similarity + time)
- [x] "Concept confusion" colored progress bars (course code + attempts)
- [x] "Material ingestion" pipeline (ready/indexing/failed tiles + stacked bar + Upload CTA)
- [x] Commit `feat(redesign/phase-g): lecturer dashboard restyle

## Phase H — Flagship screens pass
- [ ] **ChatPage**: composer with mono hint "Enter to send · Shift+Enter", grounding-scope select, chunks-in-scope count, citation superscript chips `[N]`, inline source rows (rank · bold title · locator · mono similarity), neutral chips (not accent-filled), typist dots. Keep sources right-rail toggle.
- [ ] **Resources Library**: stats strip, filter/search chips, grid/list views re-tuned to 12px radii, hairline cards, file-type tinted icons, ready/processing/failed pills, upload dialog tightened.
- [ ] **UploadResourcePage**: re-tuned to new tokens.
- [ ] **ResourceDetailDialog**: glass header, prose-academic, key-points, summary history.
- [ ] **NotesPage**: split-pane, slash menu, toolbar to 36px density, autosave pill.
- [ ] **QuizzesPage**: stats, AI generation banner, quiz cards.
- [ ] **QuizTakePage**: single-question runner, progress bar, letter-badge answers, flag, navigator, results hero with score, review.
- [ ] **MyCourses / CourseDetail / Bookmarks / Progress**: density/palette pass to new tokens (cards hairline, badges, meters).
- [ ] **ProfilePage / Settings**: AnnouncementPreferencesCard kept, rest of cards tightened to new tokens; password/change-password centered (or split where appropriate).
- [ ] **RequestInstitutionPage**: restyled.
- [ ] Commit `feat(redesign/screens): re-skin Chat, Resources, Notes, Quizzes, Courses, Bookmarks, Progress, Profile to new tokens`

## Phase 11 — Admin/Platform console (originally planned, now in new tokens)
- [ ] **AdminDashboardPage**: stats strip (tenants/users/storage/AI calls), platform-wide trend, recent activity, audit/health links.
- [ ] **AdminUsersPage**: already good; retune any border/shadow artifacts.
- [ ] **AdminQuizzesPage**: table tightened, keep publish quick-action.
- [ ] **AdminAuditPage**: filter bar + bordered table + entity-type pills.
- [ ] **PlatformConsolePage**: entry hub with cards linking to Tenants/Requests/Announcements/System Health.
- [ ] **TenantsPage**: restore Add Institution dialog (removed in frontend-rebuild) in compact-pro style; status plan quota chips; table → `card-surface`.
- [ ] **TenantDetailPage**: restore Edit dialog + Activate/Suspend; usage KPIs.
- [ ] **TenantRequestsPage** (Requests): list + review dialog (approvision / reject).
- [ ] **AnnouncementsPage**: composer with priority/target selectors, wysiwyg-lite, publish/send.
- [ ] **SystemHealthPage**: keep existing implementation; retune banners/cards.
- [ ] **TenantStructurePage / DepartmentDetail / FacultyDetail**: list cards to `card-surface-hover`, no heavy shadows.
- [ ] Commit `feat(redesign/admin-platform-console): phase 11 admin + platform pages in new tokens`

## Phase 13 — Polish pass
- [ ] **Mobile bottom tab bar** (Dashboard/Chat/Resources/Notes/Profile) + sidebar drawer for secondary items.
- [ ] **Shortcut reference dialog** (press `?` or from command palette): ⌘K, ⌘B, Enter/Shift+Enter, F focus, Esc.
- [ ] **Accessibility audit**: focus rings (accent, 2px/offset 2), icon-only buttons aria-labels, color-contrast spot check dark/light, keyboard nav in chat/notes/command palette, form errors announced.
- [ ] **PWA manifest/splash**: theme-color updated to new accent, maskable icon check, shortcut entries (Chat, Resources, Notes, Dashboard).
- [ ] **Bundle trim**: lazy-load cmdk (currently in AppShell chunk), verify route-level splits.
- [ ] **Oxlint warnings mop-up**: unused imports (BookOpen, Button, etc.), catch (e) unused vars, exhaustive-deps warnings.
- [ ] **Reduced-motion final pass**: ensure all hover/entry transitions respect reduced-motion.
- [ ] Commit `feat(redesign/polish): mobile bottom bar, shortcuts dialog, a11y, PWA, warnings`

## Final handoff
- [ ] Full regression walkthrough script (login → dashboard → chat w/ sources → upload → summary → notes → quiz → admin → platform).
- [ ] Windows one-shot commands (pull, pip install, npm install, migrate, apply_rls, Celery restart flags).
- [ ] Tag commit, changelog.
- [ ] Push `feat/frontend-redesign`.
- [ ] Next task (separate): update documentation in `docs/` to reflect new design, backend endpoints, architecture.

---

## Hard rules
- Every phase ends with: `python manage.py check` ✅, `npx oxlint` 0 errors, `npx vitest run` pass, `npm run build` green.
- Commit message prefix `feat(redesign/...)`, `fix(...)`, `chore(...)`.
- Push after every phase.
- Backend changes only additive; no existing response-shape changes unless a security bug requires it (in which case the frontend is updated in the same commit).

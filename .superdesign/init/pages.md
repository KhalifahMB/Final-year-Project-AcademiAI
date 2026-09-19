# Pages — Component Dependency Trees (AcademiAI frontend)

The candidate `--context-file` set for each page. The landing page is the current redesign target.

---

## `/` — Landing Page (REDESIGN TARGET)

**Entry:** `frontend/src/pages/LandingPage.jsx`

```
LandingPage.jsx
├── lucide-react
│   ArrowRight, BadgeCheck, BookOpen, BookOpenCheck, Bot, Calendar, Check,
│   ChevronDown, FileText, GraduationCap, ListChecks, Lock, Megaphone,
│   Quote, Rss, Search, ShieldCheck, TrendingUp, UserRound
├── @tanstack/react-query
│   useQuery
├── @/services/api
│   api (axios instance)
│   publicApi
├── @/hooks/useAuth
│   useAuth
├── @/components/shared/BrandMark.jsx
│   └── @/hooks/useTheme
│       └── useEffect, useState (localStorage + document.documentElement)
├── @/components/shared/ThemeToggle.jsx
│   ├── @/hooks/useTheme
│   ├── lucide-react: Moon, Sun
│   └── @/lib/utils (cn)
├── @/components/ui/button.jsx
│   ├── @base-ui/react/button (ButtonPrimitive)
│   ├── @/components/ui/button-variants.js
│   │   └── class-variance-authority (cva)
│   └── @/lib/utils (cn)
│       ├── clsx
│       └── tailwind-merge
```

**Global styles consumed:** `tokens.css` → `base.css` → `components.css` → `landing.css` (all loaded via `index.css` in `main.jsx`; no local CSS import). All `.landing-*` classes come from `landing.css`.

**Key context files for this page:**
- `LandingPage.jsx` (source)
- `landing.css` (all landing styles)
- `tokens.css` (design tokens)
- `BrandMark.jsx`, `ThemeToggle.jsx`, `button.jsx` (shared components used)
- `api.js` (for the live directory/stats calls)
- `DESIGN.md` (design contract)

**What the page renders (section inventory):**
1. `landing-nav` — sticky 64px glass shell: BrandMark + wordmark, nav links, ThemeToggle, auth-aware CTAs
2. `landing-hero` — Fraunces headline ("Knowledge, *cited.* Not imagined."), lede, two CTAs, GroundedChatMock (code-drawn chat window with citations)
3. `landing-trust` — "Trusted across departments" wordmarks + live institution count
4. `landing-problem` — 3 cards: fragmented materials, generic answers, hidden confusion
5. `landing-product` (solution) — 6-feature grid: grounded chat, role agents, study planner, layered calendar, quizzes, cohort signals
6. `landing-steps` — 3-step how-it-works with progress rails
7. `landing-isolation` — "Hard isolation" copy + tenant-card diagram (3 cards: TENANT_A/B/C with RLS tag, pgvector meta)
8. `landing-grounding` — GroundedChatMock + sources-rail (4 source chips with sim scores)
9. `landing-roles` — 3 role-agent cards: Student, Lecturer, Admin
10. `landing-signals` — 3 signal cards with bar meters (concept confusion, coverage gaps, early warning)
11. `landing-testimonials` — 3 quote cards with attributions
12. `landing-request` — Work email + institution form + LiveDirectory (data-backed institution search via `api.get('/tenants/directory/')`)
13. `landing-faq` — 6 details/summary items
14. `landing-footer` — BrandMark, nav links, copyright

---

## `/login` — Login Page

**Entry:** `frontend/src/pages/LoginPage.jsx`

```
LoginPage.jsx
├── landing-auth layout (from landing.css)
├── @/components/shared/BrandMark.jsx
├── @/components/shared/ThemeToggle.jsx
├── @/components/ui/button.jsx
├── @/components/ui/input.jsx (raw <input> in this page, not ui Input)
├── @/hooks/useAuth
├── @/services/api
└── react-router-dom (Link)
```
Uses `landing-auth` CSS (split layout: proof + tutor mock left, glass card right). Not in the same `.landing-page` scope as LandingPage but shares the same landing.css token system.

---

## `/dashboard` — Dashboard Page

**Entry:** `frontend/src/pages/DashboardPage.jsx`

Renders role-split home (StudentDashboard / LecturerDashboard / AdminDashboard) inside the `AppShell` layout. Heavy dependency tree through the shell, charts (recharts), query hooks, and page-specific dashboard cards. Full tree would include `AppShell.jsx` → sidebar/nav, `StatCard`, `StatusBadge`, `SearchableSelect`, `Pagination`, chart components, etc.

---

## `/request-institution` — Request Institution

**Entry:** `frontend/src/pages/RequestInstitutionPage.jsx`

Public page using `landing-auth` split layout. Similar dependency shape to LoginPage. Includes a form → request submission via `api`.

---

## `/platform` — Platform Console

**Entry:** `frontend/src/pages/PlatformConsolePage.jsx`

Superuser-only. Inside `AppShell`. Contains cross-tenant health table, request queue, analytics summary, and links to deeper platform pages. Key deps: `StatCard`, `StatusBadge`, `SkeletonRows`, `DataTable` patterns.
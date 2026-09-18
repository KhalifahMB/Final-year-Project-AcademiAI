# Extractable Components (AcademiAI frontend)

Components that appear on multiple pages or define shared UI patterns. Organized by category for the design workflow to decide which to extract as `DraftComponent` entities.

---

## Layout Components

### LandingNav
- **Source:** `frontend/src/pages/LandingPage.jsx` (~line 405)
- **Category:** layout
- **Description:** Sticky 64px glass top nav for the public landing. BrandMark + wordmark, centered section links, ThemeToggle, auth-aware CTAs.
- **Extractable props:** `isAuthenticated` (boolean, drives CTA variant), `navLinks` (array of `{label, href}`)
- **Hardcoded:** `BrandMark`, `ThemeToggle`, glass CSS (`.landing-nav`), section link labels "Product / Security / Roles / How it works", sign-in text

### LandingFooter
- **Source:** `frontend/src/pages/LandingPage.jsx` (~line 842)
- **Category:** layout
- **Description:** Public footer with brand, nav links, copyright.
- **Extractable props:** `footerLinks` (array), `copyrightText`
- **Hardcoded:** BrandMark, `.landing-footer` CSS, Security/Institutions/FAQ/Sign in links

### AppShell
- **Source:** `frontend/src/components/layout/AppShell.jsx` (929 lines)
- **Category:** layout
- **Description:** Authenticated workspace shell: collapsible sidebar (248px → 60px), topbar (56px glass), mobile drawer, command palette, floating agent, notification toaster. All role-keyed nav.
- **Extractable props:** `children` (page slot), role data comes from `useAuth()`
- **Hardcoded:** all nav section arrays (SUPERUSER_NAV, ADMIN_NAV, LECTURER_NAV, STUDENT_NAV), RoleLabel map, sidebar CSS, all icons

---

## Feature Components

### GroundedChatMock
- **Source:** `frontend/src/pages/LandingPage.jsx` (~line 286)
- **Category:** feature
- **Description:** Code-drawn chat window showing a user question → AI answer with grounded citation + meta pills (retrieved/reranked/verified). Used in hero and grounding sections.
- **Extractable props:** `userMessage` (string), `aiResponse` (string), `citations` (array of `{doc, page, score}`), `liveBadge` (boolean)
- **Hardcoded:** `.chat-window*` CSS, dots bar, status indicator, icon names

### LiveDirectory
- **Source:** `frontend/src/pages/LandingPage.jsx` (~line 218)
- **Category:** feature
- **Description:** Live institution search backed by `api.get('/tenants/directory/')`. Renders up to 6 institution rows with name, slug, and join button.
- **Extractable props:** none (data is fetched internally; `search` is local state)
- **Hardcoded:** `.landing-search`, `.landing-institution`, `.landing-data-note`, join link to `/signup`

### RequestForm
- **Source:** `frontend/src/pages/LandingPage.jsx` (~line 335)
- **Category:** feature
- **Description:** Work email + institution name form. CTA links to `/request-institution`. Includes trust line.
- **Extractable props:** none (local state, non-submitting form)
- **Hardcoded:** `.landing-request__form`, inputs, `Button` link to `/request-institution`, lock + trust text

### TenantMap (isolation diagram)
- **Source:** `frontend/src/pages/LandingPage.jsx` (~line 628, tenant cards rendered inside the isolation section)
- **Category:** feature
- **Description:** Three static tenant cards (TENANT_A/B/C) with RLS tag, domain, pgvector meta. Decorative `aria-hidden`.
- **Extractable props:** `tenants` (array of `{name, domain, tag, active, meta}`)
- **Hardcoded:** `.tenant-map`, `.tenant-card*` CSS, Lock icon, RLS badge

---

## Reusable UI Patterns (from shared components)

### StatCard
- **Source:** `frontend/src/components/shared/StatCard.jsx`
- **Category:** basic
- **Description:** KPI tile: icon + label + value + optional trend. Uses `.card` base + neomorph accent.
- **Extractable props:** `icon`, `label`, `value`, `trend`, `variant`
- **Hardcoded:** stat color/treatment

### StatusBadge
- **Source:** `frontend/src/components/shared/StatusBadge.jsx`
- **Category:** basic
- **Description:** Colored status pill (ready=green, pending=amber, processing, failed=red, draft=gray).
- **Extractable props:** `status`
- **Hardcoded:** status color mappings

### EmptyState
- **Source:** `frontend/src/components/shared/EmptyState.jsx`
- **Category:** basic
- **Description:** Centered placeholder with Lucide icon, title, description, optional CTA.
- **Extractable props:** `icon`, `title`, `description`, `action`, `actionHref`
- **Hardcoded:** dashed border style, icon size

### PageHeader
- **Source:** `frontend/src/components/shared/PageHeader.jsx`
- **Category:** basic
- **Description:** Reusable page header: title + description + action buttons.
- **Extractable props:** `title`, `description`, `actions` (ReactNode)
- **Hardcoded:** typography sizes

### SearchableSelect
- **Source:** `frontend/src/components/shared/SearchableSelect.jsx`
- **Category:** basic
- **Description:** Filtered dropdown select with search.
- **Extractable props:** `options`, `value`, `onChange`, `placeholder`
- **Hardcoded:** input style, dropdown glass overlay

### SkeletonRows
- **Source:** `frontend/src/components/shared/SkeletonRows.jsx`
- **Category:** basic
- **Description:** Loading placeholder with shimmer animation for table rows.
- **Extractable props:** `rows`, `cols`
- **Hardcoded:** `.shimmer` animation, row heights
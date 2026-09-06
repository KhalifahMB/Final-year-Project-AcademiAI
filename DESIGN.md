# DESIGN.md

<!-- impeccable:design-schema 1 -->

## Design Direction

**Style:** Glass-first premium — layered, translucent, modern. The modern-minimal grid (Linear / Vercel / Notion 2024) remains the structural foundation, elevated with a disciplined glass material system and soft neomorphic accents on high-level objects only.

**Posture:** Glass-primary, neomorph-accent. Single accent economy, hairline borders defining every material edge, translucent surfaces with `backdrop-filter`, soft inner-light depth. Both light and dark modes are equal first-class citizens — every material is derived from the theme tokens, never a hardcoded hue.

**Product category:** Academic AI platform (SaaS tool). The interface must communicate academic credibility, intelligence, trust, and institutional reliability — premium without tipping into decoration. Glass communicates the AI-product story (layered, intelligent, modern); restraint keeps density legible.

**Material philosophy:**
- **Glass is a material, not a decoration.** Every frosted surface exists to create depth: the shell floats above the canvas, cards layer over the shell, modals float highest. Glass is never placed behind long body text or dense tables.
- **Dense data stays clean.** Tables, list rows, and form fields keep high-contrast opaque backgrounds. Glass and neomorph are reserved for shell, cards, dialogs, modals, stat cards, and hero objects.
- **Neomorph is an accent, not a theme.** Soft inset/emboss depth appears on high-level objects (stat cards, trend panels, hero mock) as a whisper — never the cliché extruded-button look, never on rows or inputs.
- **Status colors are data, not decoration.** Success/warn/danger/info carry meaning only; the single accent carries emphasis.

**Anti-patterns to enforce:**
- No purple/blue gradient everything
- No giant gradient blobs
- No glass behind long-form text or dense tables (legibility)
- No neomorph on list rows, table cells, or form fields
- No burnt-in hardcoded glass/neomorph colors — all surfaces derive from tokens so both themes stay deliberate
- No icon above every heading
- No cards inside cards inside cards
- No emoji as UI icons
- No excessive animations (glass is static material, not motion)
- No huge empty hero sections
- No meaningless dashboard statistics
- No tiny low-contrast text
- Every visual element must serve a purpose

## Color System

All colors use `oklch()` for perceptual uniformity. Light and dark modes defined via CSS custom properties.

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `oklch(99% 0.002 240)` | Page canvas |
| `--surface` | `oklch(100% 0 0)` | Cards, surfaces |
| `--surface-2` | `oklch(97.7% 0.003 245)` | Secondary surfaces, inputs |
| `--hover` | `oklch(96% 0.004 245)` | Hover states |
| `--fg` | `oklch(18% 0.012 250)` | Primary text |
| `--fg-soft` | `oklch(34% 0.014 250)` | Secondary text |
| `--muted` | `oklch(54% 0.012 250)` | Muted text, placeholders |
| `--faint` | `oklch(72% 0.01 250)` | Faintest text |
| `--border` | `oklch(92% 0.005 250)` | Hairline borders |
| `--border-strong` | `oklch(85% 0.007 250)` | Stronger borders |
| `--accent` | `oklch(58% 0.18 255)` | Primary accent (indigo) |
| `--accent-strong` | `oklch(51% 0.185 255)` | Accent hover |
| `--accent-soft` | `oklch(95.8% 0.02 255)` | Accent background tint |
| `--on-accent` | `oklch(99.2% 0.002 240)` | Text on accent |
| `--success` | `oklch(48% 0.13 152)` | Success state |
| `--warn` | `oklch(49% 0.115 75)` | Warning state |
| `--danger` | `oklch(51% 0.19 27)` | Error/destructive |
| `--info` | `oklch(52% 0.12 240)` | Informational |

### Dark Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `oklch(17% 0.012 255)` | Page canvas |
| `--surface` | `oklch(20.5% 0.013 256)` | Cards, surfaces |
| `--surface-2` | `oklch(24% 0.015 257)` | Secondary surfaces |
| `--hover` | `oklch(27% 0.016 257)` | Hover states |
| `--fg` | `oklch(95.5% 0.005 250)` | Primary text |
| `--accent` | `oklch(62% 0.17 255)` | Primary accent |
| `--accent-strong` | `oklch(69% 0.155 255)` | Accent hover |
| `--accent-soft` | `oklch(30% 0.06 256)` | Accent background tint |

### Rules
- **Single accent economy.** One accent color (indigo) used for primary actions, links, and focus rings. Status colors (success/warn/danger/info) are data, not decoration.
- **All material derived from tokens.** Glass tint, blur, hairline, and neomorph depth are defined once from `--bg`/`--surface`/`--fg`/`--accent`/`--border` so light and dark both look native.
- **Status colors are semantic.** They carry meaning (success=green, danger=red) and must not be repurposed for decoration.

### Material System (glass-first)

Material is layered to create depth without breaking legibility:

| Layer | Surface | Treatment |
|-------|---------|-----------|
| Canvas | `--bg` | Solid page ground. Optional shallow gradient wash. |
| Shell glass | Sidebar, topbar, mobile drawer | Translucent tint + `backdrop-filter: blur + saturate`, hairline edge, no shadow on the edges (they meet the canvas). |
| Card glass | Cards, dashboard panels, stat cards, dialogs | Tinted fill, hairline `--border-strong`, soft `--shadow-pop`. Neomorph inset light on stat/trend panels. |
| Dense data | Tables, list rows, form fields, code | **Opaque** `--surface`/`--surface-2`. Never blurred. Never behind glass. |
| Overlay | Modals, popovers, dropdowns, command palette | Highest layer: `--shadow-pop`, stronger tint, full blur. |

**Glass recipe (theme-driven, no hardcoded hue):**
- Fill: `color-mix(in oklab, var(--surface) <n>%, transparent)` (light uses a higher tint for legibility; dark may use less).
- Blur: `backdrop-filter: blur(16px) saturate(150%)` (shell) / `blur(20px)` (overlays).
- Edge: `1px solid` a hairline from `--border`/`--border-strong`.
- Depth: `--shadow-pop` on anything floating above the shell.

**Neomorph accent recipe (subtle, high-level only):**
- Inner top light: `inset 0 1px 0 color-mix(in oklab, var(--fg) 6%, transparent)`.
- Inner bottom shadow: `inset 0 -1px 0 color-mix(in oklab, var(--fg) 8%, transparent)`.
- Optional outer drop: `0 1px 2px color-mix(in oklab, var(--fg) 6%, transparent)`.
- Never scaled to the extruded-pill "user profile card" cliché.

## Typography

### Font Stack

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
  'Inter', 'Geist Variable', ui-sans-serif, system-ui, 'Segoe UI',
  Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas,
  'Liberation Mono', monospace;
```

### Scale

| Element | Size | Weight | Letter-spacing | Line-height |
|---------|------|--------|----------------|-------------|
| Body | 15px | 400 | 0 | 1.55 |
| h1 | 30px | 650 | -0.02em | 1.15 |
| h2 | 19px | 640 | -0.01em | 1.15 |
| h3 | 15px | 600 | -0.005em | 1.15 |
| Eyebrow | 11px | 600 | 0.08em | — |
| Badge | 11.5px | 590 | 0.01em | — |
| Button | 13.5px | 580 | 0.01em | — |

### Rules
- **Body measure:** 65–75ch for long-form text. Never full-width paragraphs on large screens.
- **Headings:** Balanced wrapping (`text-wrap: balance`). No orphan headings.
- **Tabular numerals:** Use `.num` class for financial/data tables.
- **Font features:** `'cv02', 'cv03', 'cv04', 'cv11', 'ss01', 'tnum'` enabled on `<html>`.

## Spacing & Layout

### Spacing Scale

Based on 4px increments: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px.

### Layout Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--topbar-h` | 56px | Top navigation bar height |
| `--sidebar-w` | 248px | Sidebar width (expanded) |
| `--sidebar-w-collapsed` | 60px | Sidebar width (collapsed) |

### Rules
- **8px rhythm:** All spacing uses multiples of 4px, preferred multiples of 8px.
- **Section spacing:** More space above a heading than below it (e.g., `mt-8 mb-4`).
- **Tight groups, generous separation:** Elements in a group are close (8–12px); groups are separated by more (24–48px).
- **Max content width:** 1280px for main content areas.

## Borders & Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 0.25rem (4px) | Micro elements |
| `--radius-sm` | 0.375rem (6px) | Badges, small elements |
| `--radius-md` | 0.5rem (8px) | Buttons, inputs (default) |
| `--radius-lg` | 0.75rem (12px) | Cards, dialogs |
| `--radius-xl` | 0.875rem (14px) | Large cards |
| `--radius-2xl` | 1rem (16px) | Modals |

### Rules
- **Hairline borders everywhere.** `1px solid var(--border)` is the default surface treatment.
- **No rounded-full on cards.** 999px radius is for badges and avatars only.
- **No thick colored borders.** Border-left/right above 1px is banned on cards, list items, callouts.

## Shadows

Depth follows the material layer:
- **Canvas:** None.
- **Shell (sidebar/topbar):** No drop shadow — they meet the canvas edge. Hairline border only.
- **Card glass:** Soft `--shadow-pop` only where it must float above the shell (dialogs, modals, popovers, dropdowns, palette, floating stat chips). Regular cards keep hairline + inset light, not heavy drop shadows.
- **Neomorph accent (stat/trend panels, hero mock):** Subtle inner light + inner base shadow (see Material System recipe), plus an optional faint outer drop.
- **No decorative shadows.** No hard-offset (`4px 4px 0`), no colored halos.

## Surfaces

### Card Surface (dense-data & glass hybrid)

```css
.card-surface {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);   /* opaque default — used behind dense content */
}
.card-glass {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-strong);
  background: color-mix(in oklab, var(--surface) 86%, transparent);
  backdrop-filter: blur(16px) saturate(150%);
  box-shadow: 0 1px 0 color-mix(in oklab, var(--fg) 4%, transparent) inset,
              0 16px 40px -24px color-mix(in oklab, var(--fg) 18%, transparent);
}
```

- Use `.card-surface` (opaque) behind tables, lists, forms, prose.
- Use `.card-glass` for stat cards, dashboard panels, dialogs, and hero objects.
- Hover on interactive cards: hairline border lift + a very slight `--surface` brighten (property-only, no translate on data rows).

### Glass Effect (shell + overlays)

```css
.glass {                       /* shell: sidebar, topbar, drawer */
  background: color-mix(in oklab, var(--surface) 78%, transparent);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
}
.glass-overlay {               /* modals, palette, popovers */
  background: color-mix(in oklab, var(--surface) 88%, transparent);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
}
```

- Shell glass is the app frame; overlay glass is the highest layer.
- **Never** apply glass behind long body text or inside dense tables.
- Reduced-motion and low-blur fallbacks: glass is static material, so it needs no motion; keep `backdrop-filter` calls budget-conscious (avoid stacking on many elements at once).

## Buttons

| Variant | Style |
|---------|-------|
| Primary | `bg: var(--accent)`, `color: var(--on-accent)`, hover: `var(--accent-strong)` |
| Outline | `border: var(--border-strong)`, `bg: var(--surface)`, hover: `var(--hover)` |
| Ghost | `color: var(--fg-soft)`, hover: `var(--hover)` |
| Danger | `bg: var(--danger)`, `color: var(--bg)`, hover: darken 15% |

- Height: 36px (default), 42px (lg).
- Font: 13.5px / 580 weight.
- Radius: `--radius-md` (8px).
- Active press: `translateY(1px)` (respects reduced-motion).

## Forms

- **Inputs:** `bg: var(--surface-2)`, `border: 1px solid var(--border)`, radius: `--radius-md`.
- **Focus ring:** 2px solid `var(--ring)`, offset 2px, radius 4px.
- **Error state:** Red border + inline error message below input + `aria-describedby`.
- **Labels:** 13.5px / 580 weight, `var(--fg)`.
- **Helper text:** 12px, `var(--muted)`.

## Cards

- **Resource cards:** `card-glass` surface, file icon, title, description (2-line clamp), status badge, scope chip, timestamp.
- **Stat cards:** `card-glass` + neomorph accents. Icon + label + value + optional trend. No sparklines.
- **Dashboard cards:** `card-glass`. Section header (h2) + content. No nested cards (opaque panels inside glass is fine for tables/charts).

## Tables

- **Overflow:** `overflow-x-auto` wrapper for responsive tables.
- **Header:** `bg: var(--surface-2)`, `font-weight: 600`, `11.5px uppercase tracking`.
- **Rows:** `border-bottom: 1px solid var(--border)`.
- **Hover:** `bg: var(--hover)`.
- **Empty state:** Centered message with action CTA.

## Dialogs & Modals

- **Overlay:** `bg: rgba(0,0,0,0.5)` + backdrop blur (theme-driven).
- **Container:** `card-glass` / `.glass-overlay` fill, `--radius-2xl` (16px), `--shadow-pop`.
- **Focus trap:** Tab key trapped inside dialog. Escape closes.
- **Close:** X button + Escape key.

## Navigation

### Sidebar (Desktop)
- Fixed left, 248px (collapsible to 60px). `glass` shell surface.
- Role-keyed sections (Student, Lecturer, Admin, Superuser).
- Active item: `var(--accent-soft)` bg, `var(--accent-strong)` text (accent fills the glass on the active row).
- Hover: `var(--hover)` bg.
- Collapse: icons only, 60px width.

### Topbar
- Sticky, topbar `glass`. Hairline bottom edge only (no drop shadow — it meets the shell).
- Hamburger (mobile), search, online status, theme toggle, user menu.

### Mobile Drawer
- Full-height `glass` drawer with backdrop blur.
- Auto-closes on route change.

## Alerts & Badges

### Badges
```css
.badge { background: var(--surface-2); border: 1px solid var(--border); color: var(--fg-soft); }
.badge-ok { background: var(--success-soft); color: var(--success); }
.badge-warn { background: var(--warn-soft); color: var(--warn); }
.badge-bad { background: var(--danger-soft); color: var(--danger); }
```

### Status Badges
- `ready` → green, `pending` → amber, `processing` → pulse animation, `failed` → red, `draft` → gray.

## Loading States

- **Skeleton:** Animated shimmer overlay on placeholder rectangles.
- **Route loading:** Branded `BrandMark` animation with "Loading..." text.
- **Button loading:** Spinner inline, button disabled.
- **Table loading:** `SkeletonRows` with staggered delay.

## Empty States

- Centered layout with dashed border.
- Icon (Lucide), title, description, optional CTA link.
- Never blank screens. Always guide the user.

## Error States

- **Route error:** `ErrorBoundary` with message + reload button.
- **API error:** Toast notification (sonner) with retry option.
- **Form error:** Inline field errors + `aria-describedby`.
- **Page error:** Error card with friendly message, no stack traces.

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| < 768px | Single column, mobile drawer nav, stacked cards |
| 768–1023px | Two-column where appropriate, tablet nav |
| ≥ 1024px | Full sidebar + content layout |
| ≥ 1440px | Max-width 1280px content area |

### Rules
- **Never shrink desktop layouts.** Redesign for mobile, don't just scale.
- **Tables:** Horizontal scroll on mobile. Card layout alternative for narrow screens.
- **Navigation:** Sidebar → hamburger drawer on mobile.
- **Touch targets:** Minimum 44px × 44px.

## Accessibility

- **Semantic HTML:** `<nav>`, `<main>`, `<header>`, `<article>`, `<section>`.
- **Keyboard navigation:** Visible focus rings, logical tab order, no keyboard traps.
- **Focus ring:** 2px solid `var(--ring)`, offset 2px.
- **Screen readers:** `aria-label` on icon-only buttons, `aria-live` for dynamic content, `role="alert"` for errors.
- **Reduced motion:** All animations respect `prefers-reduced-motion: reduce`.
- **Contrast:** Body text ≥4.5:1, large text ≥3:1.
- **Color independence:** Status never communicated by color alone (always paired with text/icon).

## Motion

- **Page entrance:** `fade-in 0.22s cubic-bezier(.2,0,0,1)`.
- **Content slide-up:** `slide-up 0.22s cubic-bezier(0.2,0,0,1)`.
- **Scale-in (dialogs):** `scale-in 0.15s ease-out`.
- **Button press:** `translateY(1px)` on active.
- **Reduced motion:** All animation durations set to 0.01ms.

### Rules
- **One authored moment per page,** not scattered effects.
- **Exponential ease-out** from an already-visible default.
- **Exit faster than enter.**
- **No infinite animations** except loading spinners/shimmer.

## Component Inventory

### Existing (preserve and improve)
- `BrandMark` — AcademiAI logo (light/dark variants)
- `Avatar` — 3-tier fallback (upload → preset → initials)
- `ConfirmDialog` — Controlled alert dialog
- `EmptyState` — Centered placeholder with CTA
- `EntityDialog` — Field-spec-driven CRUD modal
- `StatCard` — KPI tile
- `StatusBadge` — Colored status pill
- `SkeletonRows` — Loading placeholder
- `ThemeToggle` — Light/dark switcher
- `CommandPalette` — Cmd+K global search
- `ErrorBoundary` — Route-level error handling
- `ResourceCard` — Resource grid card
- `ResourceDetailDialog` — Full-screen resource viewer (needs decomposition)

### Missing (to create)
- `PageHeader` — Reusable page header (title + description + actions)
- `Breadcrumbs` — Navigation hierarchy
- `Pagination` — Shared pagination component
- `DataTable` — Sortable/filterable table wrapper
- `SearchBar` — Reusable search input with debounce
- `FormField` — Consistent form field wrapper (label + input + error + helper)
- `AsyncState` — Wrapper for loading/error/empty/success states

### Landing (Persuade)
- Hero visual is a **theme-aware, code-drawn app mock** (no baked-in PNG): a `card-glass` chat window with a live `ai-cursor`, cited-answer chips, and a soft accent halo + fg-derived dot grid. Both themes equal.
- Motion: staggered hero entrance, slow mock drift, badge bob, scroll-reveal, animated gradient hairline on the CTA — all `prefers-reduced-motion` safe.

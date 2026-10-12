# DESIGN.md

<!-- impeccable:design-schema 1 -->

## Design Direction

**Style:** Grounded institutional — precise, credible, technical. Near-black and warm-paper canvases, hairline borders defining every panel, a single **Cinnabar** accent (scholarly oxblood, `oklch(0.415 0.125 27)`) for action and focus, mono metadata everywhere the machine talks.

**Posture:** Hard-surface, hairline-primary. Surfaces are opaque flat panels with `1px` hairlines; the shell (topbar) may blur over content because density scrolls beneath it. A single accent economy — Cinnabar is reserved for primary actions, links, active nav, and focus rings. Status colors are data, never decoration. Zero color gradients anywhere: interest comes from grain/grid texture, hairlines, and mono metadata. Both light and dark themes are equal first-class citizens, derived entirely from tokens.

**Product category:** Multi-tenant academic AI platform. The interface must communicate trust, isolation, and institutional seriousness (RLS-guarded RAG). The design borrows from developer tooling (Linear / Vercel) for credibility: dense but legible, technical but calm, premium without decoration.

**Material philosophy:**
- **Hairline surfaces, not glass everything.** Panels are opaque (`--surface`/`--surface-2`) with `1px` hairlines. Translucency + `backdrop-filter` is reserved for the floating shell (topbar) and overlays (modals, command palette) only. Never glass behind long-form text or dense tables.
- **Dense data stays clean.** Tables, list rows, form fields, and code keep high-contrast opaque backgrounds.
- **Dual text system.** The landing voice is editorial serif (Fraunces + Inter); the authenticated app is functional (Geist + Geist Mono). The serif is a landing/signpost voice, never an in-app default.
- **Status colors are data, not decoration.** Success/warn/danger carry meaning only; the single Cinnabar accent carries emphasis. Info is slate — information is carried by form (mono badges), not hue.

**Anti-patterns to enforce:**
- No color gradients anywhere (zero-gradient ban — the only allowed `gradient()` uses are the 48px grid pattern, `mask-image` fades, and the skeleton shimmer)
- No confetti tone palettes: counts and metadata render neutral; color appears only when a value is a status
- No giant gradient blobs
- No glass behind long-form text or dense tables (legibility)
- No neomorph on list rows, table cells, or form fields
- No burnt-in hardcoded glass/neomorph colors — all surfaces derive from tokens so both themes stay deliberate
- No icon above every heading
- No cards inside cards inside cards
- No emoji as UI icons
- No excessive animations
- No huge empty hero sections
- No meaningless dashboard statistics
- No tiny low-contrast text
- No un-cited AI answers in demos (every AI answer shows its grounding)
- Every visual element must serve a purpose

## Color System

All colors use `oklch()` for perceptual uniformity. Light and dark modes defined via CSS custom properties. Brand accent is **Cinnabar** — scholarly oxblood `oklch(0.415 0.125 27)` (≈ `#8A2A24`), named for the red mineral pigment of seal and rubric. Light text/borders share one warm sepia-ink family (hue ~62–84) with the paper canvas; dark canvases anchor to warm near-black (hue 62).

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `oklch(0.973 0.011 84)` | Page canvas (Atlas paper) |
| `--surface` | `oklch(0.986 0.009 84)` | Cards, surfaces |
| `--surface-2` | `oklch(0.951 0.014 82)` | Secondary surfaces, inputs |
| `--hover` | `oklch(0.928 0.016 80)` | Hover states |
| `--fg` | `oklch(0.245 0.02 62)` | Primary text (warm sepia ink) |
| `--fg-soft` | `oklch(0.4 0.02 62)` | Secondary text |
| `--muted` | `oklch(0.45 0.018 62)` | Muted text, placeholders |
| `--faint` | `oklch(0.56 0.016 66)` | Faintest text |
| `--border` | `oklch(0.855 0.02 78)` | Hairline borders |
| `--border-strong` | `oklch(0.7 0.03 72)` | Stronger borders |
| `--accent` | `oklch(0.415 0.125 27)` | Cinnabar — primary accent |
| `--accent-strong` | `oklch(0.355 0.12 27)` | Accent hover |
| `--accent-soft` | `oklch(0.945 0.028 32)` | Accent background tint |
| `--on-accent` | `oklch(0.985 0.008 84)` | Text on accent |
| `--success` | `oklch(0.5 0.125 150)` | Success state |
| `--warn` | `oklch(0.5 0.115 80)` | Warning state |
| `--danger` | `oklch(0.52 0.19 25)` | Error/destructive |
| `--info` | `oklch(0.45 0.02 260)` | Informational (slate) |

### Dark Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `oklch(0.165 0.012 62)` | Page canvas (warm near-black) |
| `--surface` | `oklch(0.198 0.014 62)` | Cards, surfaces |
| `--surface-2` | `oklch(0.205 0.014 62)` | Secondary surfaces |
| `--hover` | `oklch(0.245 0.016 62)` | Hover states |
| `--fg` | `oklch(0.945 0.012 75)` | Primary text |
| `--accent` | `oklch(0.72 0.12 30)` | Cinnabar (lifted for dark bg; `--on-accent` flips to ink) |
| `--accent-strong` | `oklch(0.8 0.11 32)` | Accent hover |
| `--accent-soft` | `oklch(0.28 0.05 30)` | Accent background tint |

### Rules
- **Single accent economy.** One Cinnabar accent used for primary actions, links, active nav, and focus rings. Never a second hue for emphasis.
- **Zero color gradients.** No color-ramp backgrounds or gradient text anywhere. Permitted `gradient()` uses: the 48px blueprint grid, `mask-image` fades, and the skeleton shimmer.
- **Neutral metadata.** File-type chips and visibility scopes render in one neutral treatment (`surface-2` + `fg-soft`); they are metadata, not status.
- **All material derived from tokens.** Shell tint, blur, hairline, and depth defined once from `--bg`/`--surface`/`--fg`/`--accent`/`--border` so light and dark both look native.
- **Status colors are semantic.** They carry meaning (success=green, danger=red) and must not be repurposed for decoration.

### Material System (grounded hairline)

Material is layered to create depth without breaking legibility:

| Layer | Surface | Treatment |
|-------|---------|-----------|
| Canvas | `--bg` | Solid page ground. Optional 48px `texture-grid` + `texture-grain` overlay (landing). |
| Shell | Topbar | Translucent tint + `backdrop-filter: blur + saturate`, hairline bottom edge, no drop shadow. |
| Panels | Cards, dashboard cards, stat cards, dialogs | Opaque `--surface`, 1px `--border-strong` hairline, radius `--radius-lg`. Soft shadow `--shadow-pop` reserved for floats. |
| Dense data | Tables, list rows, form fields, code | **Opaque** `--surface`/`--surface-2`. Never blurred. Never behind glass. |
| Overlay | Modals, popovers, dropdowns, command palette | Highest layer: `--shadow-pop`, stronger tint, full blur. |

**Shell recipe (theme-driven, no hardcoded hue):**
- Fill: `color-mix(in oklab, var(--surface) 80%, transparent)`.
- Blur: `backdrop-filter: blur(16px) saturate(150%)` (shell) / `blur(22px)` (overlays).
- Edge: `1px solid` a hairline from `--border`/`--border-strong`.

**Neomorph accent recipe (subtle, high-level only):**
- Inner top light: `inset 0 1px 0 color-mix(in oklab, var(--fg) 6%, transparent)`.
- Inner bottom shadow: `inset 0 -1px 0 color-mix(in oklab, var(--fg) 9%, transparent)`.
- Used only on stat/trend panels and hero objects; never on list rows, inputs, or buttons.

## Typography

### Font Stack

In-app (Geist + Geist Mono); landing (Fraunces + Inter):

```css
--font-sans: 'Geist Variable', 'Geist', -apple-system, BlinkMacSystemFont,
  'SF Pro Display', 'SF Pro Text', 'Inter', ui-sans-serif, system-ui,
  'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-serif: 'Fraunces Variable', 'Fraunces', Georgia, 'Times New Roman', serif;
--font-mono: 'Geist Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo,
  Consolas, 'Liberation Mono', monospace;
--font-display: var(--font-sans);   /* app headings stay sans */
```

Fonts are self-hosted via `@fontsource-variable` (Geist, Geist Mono, Fraunces), imported in `main.jsx`, so they bundle with the build and work offline.

### Scale (app)

| Element | Size | Weight | Letter-spacing | Line-height |
|---------|------|--------|----------------|-------------|
| Body | 15px | 400 | 0 | 1.55 |
| h1 | 30px | 650 | -0.02em | 1.15 |
| h2 | 19px | 640 | -0.01em | 1.15 |
| h3 | 15px | 600 | -0.005em | 1.15 |
| Eyebrow | 11px | 600 | 0.08em | — |
| Badge | 11.5px | 590 | 0.01em | — |
| Button | 13.5px | 580 | 0.01em | — |
| Mono meta | 11–12px | 500 | 0.02em | — |

### Scale (landing — editorial serif)

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Hero h1 | `clamp(40px, 6vw, 84px)` | 500–600 | Fraunces, `letter-spacing: -0.03em`, `text-wrap: balance`, `line-height: 0.98` |
| Section h2 | `clamp(30px, 4vw, 52px)` | 500–600 | Fraunces, `max-width: 12ch` |
| Serif card title | 21–24px | 500 | Fraunces |
| Body/lede | 15–16px | 400 | Inter, `line-height: 1.65` |

### Rules
- **One serif voice only:** Fraunces appears on the public landing/auth shell; it never becomes an in-app default heading face.
- **Wordmark lockup:** the landing/auth brand sets the name in Fraunces with the "AI" suffix in `--accent-strong` (`.landing-brand`); in-app marks stay sans.
- **Mono for machine voice:** IDs, tenant metadata, `v2.1 • RLS`-style badges, RAG confidence, timestamps use Geist Mono.
- **Body measure:** 65–75ch for long-form text. Never full-width paragraphs on large screens.
- **Headings:** Balanced wrapping (`text-wrap: balance`). No orphan headings.
- **Font features:** `'cv02', 'cv03', 'cv04', 'cv11', 'ss01', 'tnum'` enabled on `<html>`.
- **Secondary text roles:** reach for `.eyebrow`, `.text-caption`, `.text-mono-meta` (`styles/components.css`) before writing a `text-[Npx]` literal. New code must not add arbitrary sizes; existing ones are known debt.

> **Known debt (measured 2026-09-22):** 522 `text-[Npx]` literals across 78 files predate these
> utilities. They were deliberately not swept in one pass — a mechanical conversion changes
> size and line-height on dense pages at once and needs page-by-page visual QA. Convert a
> file when you are already editing it.

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
- **Tight groups, generous separation:** Elements in a group are close (8–12px); groups separated by more (24–48px).
- **Max content width:** 1280px for main content areas; landing sections cap at 1200px.

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
- **Active nav/pill:** accent-soft fill + accent text; never a thick colored left border.

## Shadows

Depth follows the material layer:
- **Canvas:** None.
- **Shell (topbar):** No drop shadow — it meets the canvas. Hairline bottom edge only.
- **Panels:** Hairline + a whisper of inner top light (`inset 0 1px 0`). Regular cards do not float.
- **Floating:** `--shadow-pop` only on dialogs, modals, popovers, dropdowns, palette.
- **No decorative shadows.** No hard-offset (`4px 4px 0`), no colored halos.

## Surfaces

### Panel Surface (opaque default)

```css
.panel-surface {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
}
```

- Panels are opaque. Use them for stat cards, dashboard cards, tables, lists, forms.
- Hover on interactive cards: hairline border lift + a very slight `--surface-2` brighten (property-only, no translate on data rows).

### Shell Glass (topbar + overlays only)

```css
.glass {                       /* shell: topbar, drawer */
  background: color-mix(in oklab, var(--surface) 80%, transparent);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
}
.glass-overlay {               /* modals, palette, popovers */
  background: color-mix(in oklab, var(--surface) 90%, transparent);
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
}
```

- **Never** apply glass behind long body text or inside dense tables.

### Textures

```css
.texture-grain  /* static SVG feTurbulence overlay, ~5% opacity (8% dark) */
.texture-grid   /* 48px grid from --fg, 6% tint */
.texture-grid--faint  /* 4% tint variant */
```

- Grain + grid are landing/hero textures and optional hero backdrops; keep them out of dense data areas.

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
- **One implementation only:** `components/ui/button.jsx` (+ `button-variants.js`). The old
  `.btn` / `.btn-*` CSS utilities were deleted once nothing imported them; don't reintroduce a
  parallel button system as class strings. Use `<Button asChild>` to style a `<Link>`.

## Forms

- **Inputs:** `bg: var(--surface-2)`, `border: 1px solid var(--border)`, radius: `--radius-md`.
- **Focus ring:** 2px solid `var(--ring)`, offset 2px, radius 4px.
- **Error state:** Red border + inline error message below input + `aria-describedby`.
- **Labels:** 13.5px / 580 weight, `var(--fg)`.
- **Helper text:** 12px, `var(--muted)`.

## Cards

- **Resource cards:** `panel-surface`, file icon, title, description (2-line clamp), status badge, scope chip, timestamp.
- **Stat cards:** `panel-surface` + subtle neomorph accent (see Material). Icon + label + value + optional trend. No sparklines.
- **Dashboard cards:** `panel-surface`. Section header (h2) + content. No nested cards (opaque sub-panels for tables/charts is fine).
- **StatTile tones are semantic:** `neutral` (default) for plain counts, `accent` for a headline metric, ok/warn/bad/info only when the number itself is a status (ready/failed buckets, threshold-gated scores). Never decorative variety.
- **KPI strips:** a row of StatTiles shares one hairline panel via `StatStrip` (internal 1px dividers, horizontal scroll on narrow screens) — never a grid of separate bordered cards.
- **Version/meta badges:** Geist Mono, `surface-2` fill, hairline, uppercase micro-label + value (e.g. `v2.1 • RLS`).

## Tables

- **Overflow:** `overflow-x-auto` wrapper for responsive tables.
- **Header:** `bg: var(--surface-2)`, `font-weight: 600`, `11.5px uppercase tracking`.
- **Rows:** `border-bottom: 1px solid var(--border)`.
- **Hover:** `bg: var(--hover)`.
- **Empty state:** Centered message with action CTA.

## Dialogs & Modals

- **Overlay:** `bg: rgba(0,0,0,0.5)` + backdrop blur (theme-driven).
- **Container:** `panel-surface` / `.glass-overlay` fill, `--radius-2xl` (16px), `--shadow-pop`.
- **Focus trap:** Tab key trapped inside dialog. Escape closes.
- **Close:** X button + Escape key.

## Navigation

### Sidebar (Desktop)
- Fixed left, 248px (collapsible to 60px). Opaque surface with hairline right edge.
- Role-keyed sections (Student, Lecturer, Admin, Superuser).
- Active item: `var(--accent-soft)` bg, `var(--accent-strong)` text.
- Hover: `var(--hover)` bg.
- Collapse: icons only, 60px width.

### Topbar
- Sticky 56px, `glass` shell. Hairline bottom edge only (no drop shadow — it meets the shell).
- Hamburger (mobile), search, online status, theme toggle, user menu.
- Optional mono metadata badge (version · isolation) on the right gutter.

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

### Illustrations

`components/shared/illustrations.jsx` holds the empty-state line art; pass it to
`<EmptyState illustration={…}>`, which swaps it in for the icon circle. Error
states keep the alert icon — an illustration belongs to an *empty* state, never
a broken one.

- **Inline SVG, never an image file.** An `<img src="*.svg">` is an isolated
  document and cannot read the app's custom properties, so a raster or external
  asset would hardcode a hue and need a second dark-mode copy. Inline art reads
  `currentColor` and `var(--accent)` and covers both themes from one source.
- **Spec:** 96×96 viewBox, `fill: none`, `stroke: currentColor`, 1.5 stroke
  width, round caps and joins, exactly one `var(--accent)` detail.
- **Decorative.** `aria-hidden="true"` — the `title` prop is what screen readers
  announce.
- **No baked-in content.** Never put words, numbers, metrics or institution
  names in the art; they cannot be translated, cannot be verified, and go stale.
- Rendered at `h-24 w-24` by `EmptyState`; `h-20 w-20` inside a tighter hero.

## Error States

- **Route error:** `ErrorBoundary` with message + reload button.
- **API error:** Toast notification (sonner) with retry option.
- **Form error:** Inline field errors + `aria-describedby`.
- **Page error:** Error card with friendly message, no stack traces.

## Landing System (public + auth)

- **Voice:** Editorial serif (Fraunces for display, Inter for body). Scoped via `.landing-page`/`.landing-auth`.
- **Nav:** Centered AcademiAI brand with the official logo, links (Product / Security / Roles / How it works), `Sign in` + `Request workspace` CTAs.
- **Hero:** Eyebrow (`MULTI-TENANT • GROUNDED • INSTITUTION-FIRST`), serif H1, two CTAs, and a code-drawn grounded chat mock with visible citations.
- **Dept trust strip:** Institution wordmarks. One row, hairline separation.
- **Sections:** Problem → platform capabilities ledger → 3 grounding steps → hard-isolation diagram → grounding demo → role agents → confusion signals → commitments → institution request form.
- **Request form:** Work email + institution name → leads to institution onboarding.
- Both themes are token-driven and first-class; grain + grid textures optional at section scale.

### Landing plates

`components/shared/landingPlates.jsx` holds the section-scale line art, wired into
the landing as a media column beside a section heading. The landing page stays
code-drawn: no photography, no rendered product screenshots. (This is a rule about the
**landing page**, not the repo — marketing imagery lives outside it, below.)

- **Same inline-SVG rule as empty-state illustrations.** An `<img src="*.svg">`
  cannot read the app's custom properties, so a raster file can never be
  theme-aware. Plates use `currentColor` plus exactly one `var(--accent)` detail
  and invert correctly in both themes.
- **Wordless, fact-free.** No text, numbers, metrics, citations or institution
  names in the art. A picture that asserts a statistic is a claim no one can
  verify, and it goes stale silently.
- **Must carry an argument.** A plate earns its bytes by depicting the section's
  point (`FragmentedMaterialsPlate` draws two document stacks on rails that never
  meet). Art that only decorates a heading violates "every visual element must
  serve a purpose" — don't add one.
- Larger canvas than empty-state art: `0 0 320 240`, `stroke-width: 1.5`, capped
  at `420px` by `.landing-section__heading--split > :last-child`.

### Generated brand assets (marketing only)

`docs/BRAND_ASSETS.md` holds the prompts for the **marketing** imagery: one hero
plate (a still life of three sealed tenant volumes on rails that never meet) and a
six-mark icon set drawn at Lucide's silhouette with photographic material. Generated
imagery is permitted **outside** the app — OG/social images, press kit, docs.

- **Never enters the UI.** A generated raster in a component is an `<img>`: an
  isolated document that cannot read the app's custom properties. It hardcodes its
  hue at generation time and needs a second, separately-baked dark-mode copy per
  asset — a 2× asset count that silently desynchronises the moment a token moves.
  The interface keeps inline SVG + `lucide-react`, which theme for free from one
  source.
- **The logo is the deliberate exception.** Favicons, PWA icons, apple-touch icons and
  `og:image` are consumed by browsers and crawlers, not by React — nothing can hand
  them a CSS custom property, so `BrandMark`'s two baked copies are the only option,
  not a compromise. `public/favicon.svg` is the one logo asset that *can* be
  theme-aware, so it is hand-traced rather than generated.
- **Single accent.** Cinnabar is the only chromatic colour; there is no purple,
  violet, indigo or magenta in the shipped palette. Purple in a render is a bad
  render, not a variant. Status hues stay semantic.
- **Wordless and fact-free,** by the same rule as plates and illustrations: no text,
  numbers, metrics, citations or institution names baked into an image.
- Both themes are first-class: generate a Light and a Dark plate per asset.
- Renders live in the asset store, **not** in version control.

### Eyebrow specificity trap

`.landing-eyebrow` is a `<p>`, so any `.landing-section__heading p`-style
descendant rule outranks it and silently downgrades the eyebrow to body copy.
Section paragraph rules must exclude it: `p:not(.landing-eyebrow)`. Ten of the
eleven landing eyebrows were rendering at 16px muted instead of 11px Cinnabar mono
before this was fixed.

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
- **Landing only:** staggered hero entrance, slow mock drift, scroll-reveal — all `prefers-reduced-motion` safe.
- **Reduced motion:** All animation durations set to 0.01ms.

### Rules
- **One authored moment per page,** not scattered effects.
- **No infinite animations** except loading spinners/shimmer.

## Component Inventory

### Existing (preserve)
- `BrandMark` — **official AcademiAI mark** (the Cinnabar "A" with an accent underline). Rendered as **theme-aware inline SVG** in `BrandMark.jsx`, so it follows the design tokens and needs no baked per-theme copy. Static brand SVGs ship at `frontend/public/brand/cinnabar-mark-{light,dark}.svg` and `app-icon.svg` (the maskable source); `frontend/public/favicon.svg` is adaptive via `prefers-color-scheme`. PNG fallbacks (`favicon-{16,32,48}`, `apple-touch-icon`, `pwa-{192,512}`) are rasterised from those SVGs and must be regenerated together when the mark changes. Page content stays inline SVG.
- `Avatar` — 3-tier fallback (upload → preset → initials)
- `ConfirmDialog` — Controlled alert dialog
- `EmptyState` — Centered placeholder with CTA
- `EntityDialog` — Field-spec-driven CRUD modal
- `StatCard` — KPI tile
- `StatusBadge` — Colored status pill
- `SkeletonRows` — Loading placeholder
- `ThemeToggle` — Light/dark switcher
- `CommandPalette` — Cmd+K global search
- `NotificationInbox` — Topbar bell + unread badge, feed dropdown
- `NotificationToaster` — Session-deduped warn/critical toasts (read-state neutral)
- `ErrorBoundary` — Route-level error handling
- `ResourceCard` — Resource grid card

### Missing (to create where needed)
- `PageHeader` — Reusable page header (title + description + actions)
- `Breadcrumbs` — Navigation hierarchy
- `Pagination` — Shared pagination component
- `DataTable` — Sortable/filterable table wrapper
- `SearchBar` — Reusable search input with debounce
- `FormField` — Consistent form field wrapper (label + input + error + helper)

### Dashboards (role-specific)
- **Student:** greeting strip, grounded AI chat preview (query → retrieve → rerank → generate + cited snippet), study plans, layered calendar, recent resources, quiz attempts.
- **Lecturer:** course co-pilot summary, resource quality, duplicate detection, ranked cohort signals, quiz drafts queue, student mastery grid, office hours, announcement composer, course analytics.
- **Admin:** tenant workspace (domain, RLS, pgvector, region), institutional hierarchy, user management, access-rules matrix, announcement dispatch, health indicators, audit log.
- **Platform (superuser):** cross-tenant health table, institution requests queue (approve/reject), global analytics, RAG evaluation, system logs.
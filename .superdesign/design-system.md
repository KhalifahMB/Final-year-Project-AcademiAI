# AcademiAI — Design System

## Product context

AcademiAI is a multi-tenant AI-powered academic assistant and intelligent resource hub. Universities get their own isolated AI workspace: grounded chat, quizzes, and cohort insight drawn from the institution's own authorised materials, with every claim traced to a page. The differentiator is three mechanisms no neighbor combines: (1) AI answers strictly RAG-grounded in tenant-uploaded resources, never hallucinated, (2) strict multi-tenant isolation via PostgreSQL RLS — per-institution siloing at the database layer, (3) a concept-aware retrieval graph. Users: students, lecturers, tenant admins, platform superusers. The public marketing surface is the landing page (`/`); authenticated users see a role-keyed workspace shell.

## JTBD

A university student/lecturer/administrator considering AcademiAI must immediately believe: (1) answers are trustworthy because they cite the institution's own materials, (2) each institution's data is hard-isolated from every other, (3) the product serves each working role differently, (4) adoption is quick (provisioned in under 48h, free to start).

## Key pages

- `/` Landing page — the redesign target. Single long page: nav (sticky glass 64px) → hero (eyebrow + Fraunces headline + two CTAs + code-drawn grounded chat mock) → trust strip → problem (3 cards) → platform (6-feature grid) → how it works (3 steps with progress rails) → isolation (copy + tenant-card diagram) → grounding in action (chat mock + sources rail) → roles (3 role cards) → signals (3 cards with bar meters) → testimonials (3 quotes) → request + live institution directory → FAQ (6 details) → footer.

## Branding & styling

### Voice & posture
"Grounded institutional" — precise, credible, technical. Near-black and warm-paper canvases, hairline borders defining every panel, a single brand-violet accent for action and focus, mono metadata everywhere the machine talks. Borrows from developer tooling (Linear/Vercel) for credibility: dense but legible, technical but calm, premium without decoration.

- Hard-surface, hairline-primary. Panels are OPAQUE flat surfaces with 1px hairlines. Glass (translucency + backdrop-filter) is reserved for the floating shell (topbar/nav) and overlays (modals, palette) ONLY. Never glass behind long-form text or dense data.
- Single accent economy. One violet `#6C5CE7` for primary actions, links, active nav, focus rings. Status colors (green/amber/red/blue) are data, never decoration.
- Dual text system. Landing = editorial serif (Fraunces display + Inter body). Authenticated app = Geist + Geist Mono. Serif is a landing/signpost voice only.
- Both light and dark themes are equal first-class citizens, derived entirely from tokens.

### Anti-patterns to enforce
No purple/blue gradient everything. No giant gradient blobs. No glass behind long-form text or dense tables. No neomorph on list rows/table cells/form fields. No hardcoded hues — everything theme-derived. No icon above every heading. No cards inside cards inside cards. No emoji as UI icons. No excessive animation. No huge empty hero sections. No meaningless stats. No tiny low-contrast text. No un-cited AI answers in demos — every AI answer must show its grounding/citations.

## Color system

All colors are `oklch()`, token-driven. Brand violet `#6C5CE7 ≈ oklch(0.577 0.195 282)`.

### Light mode
| Token | Value | Usage |
|---|---|---|
| `--bg` | `oklch(0.985 0.003 85)` | canvas (warm paper `#FAF9F6`) |
| `--surface` | `oklch(0.995 0.002 85)` | cards/panels |
| `--surface-2` | `oklch(0.965 0.004 85)` | inputs, secondary surfaces |
| `--hover` | `oklch(0.945 0.005 85)` | hover |
| `--fg` | `oklch(0.2 0.018 285)` | primary text |
| `--fg-soft` | `oklch(0.37 0.02 285)` | secondary text |
| `--muted` | `oklch(0.53 0.015 285)` | muted text/placeholders |
| `--faint` | `oklch(0.7 0.01 285)` | faintest text |
| `--border` | `oklch(0.905 0.006 85)` | hairline borders |
| `--border-strong` | `oklch(0.83 0.008 85)` | stronger borders |
| `--ring` | `oklch(0.577 0.195 282)` | focus rings |
| `--accent` | `oklch(0.577 0.195 282)` | violet — primary |
| `--accent-strong` | `oklch(0.5 0.19 282)` | accent hover |
| `--accent-soft` | `oklch(0.945 0.028 282)` | accent tint bg |
| `--accent-line` | `oklch(0.86 0.07 282)` | accent hairlines |
| `--on-accent` | `oklch(0.99 0.002 85)` | text on accent |
| `--success` | `oklch(0.5 0.125 150)` | success (data) |
| `--warn` | `oklch(0.5 0.115 80)` | warning (data) |
| `--danger` | `oklch(0.52 0.19 25)` | destructive |
| `--info` | `oklch(0.52 0.11 245)` | info (data) |

### Dark mode
`--bg 0.145 0.015 282` (near-black `#0B0B0E`), `--surface 0.19 0.018 282`, `--surface-2 0.235 0.02 282`, `--hover 0.27 0.022 282`, `--fg 0.97 0.008 282`, `--fg-soft 0.85 0.01 282`, `--muted 0.68 0.012 282`, `--faint 0.52 0.015 282`, `--border 0.275 0.02 282`, `--border-strong 0.35 0.025 282`, `--ring 0.72 0.17 282`, `--accent 0.72 0.17 282`, `--accent-strong 0.78 0.15 282`, `--accent-soft 0.32 0.07 282`, `--accent-line 0.42 0.09 282`, `--on-accent 0.98 0.005 282`, `--success 0.75 0.13 152`, `--warn 0.79 0.12 85`, `--danger 0.71 0.17 25`, `--info 0.73 0.11 245`.

### Rules
- Single accent economy: one violet for emphasis; status colors carry meaning only.
- All material derived from tokens so both themes look native. No burnt-in hardcoded glass/neomorph colors.

## Material system (grounded hairline)

| Layer | Surface | Treatment |
|---|---|---|
| Canvas | `--bg` | solid page ground; optional 48px grid + grain texture on landing |
| Shell | topbar/nav | translucent tint `color-mix(in oklab, var(--surface) 80%, transparent)` + `backdrop-filter: blur(16px) saturate(150%)`, hairline bottom edge, no drop shadow |
| Panels | cards | opaque `--surface`, 1px `--border`/`--border-strong` hairline, `--radius-lg`(12px) |
| Dense data | tables/rows/forms | opaque — never blurred, never behind glass |
| Overlay | modals/popovers/palette | `--shadow-pop`, stronger tint, blur(22px) |

Neomorph accent (subtle, high-level objects only): `inset 0 1px 0 color-mix(in oklab, var(--fg) 6%, transparent)` + `inset 0 -1px 0 color-mix(in oklab, var(--fg) 9%, transparent)` — stat/trend panels and hero objects only; never inputs/rows/buttons.

Textures (landing only): `.texture-grain` = static SVG feTurbulence at ~5% opacity (8% dark) with `mix-blend-mode: overlay`; `.texture-grid` = 48px grid from `--fg` 6% tint; `.texture-grid--faint` = 4%. Hero background: faint violet radial-glow (`color-mix accent 7–12%`, masked fade) + 48px grid mask.

## Typography

```
--font-sans: 'Geist Variable','Geist',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Inter',ui-sans-serif,system-ui,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
--font-serif: 'Fraunces Variable','Fraunces',Georgia,'Times New Roman',serif;
--font-mono: 'Geist Mono',ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;
--font-display: var(--font-sans);
```
Self-hosted via `@fontsource-variable` (Geist, Geist Mono, Fraunces).

### Landing scale (editorial serif — the redesign target)
| Element | Size | Weight | Notes |
|---|---|---|---|
| Hero h1 | `clamp(34px,4.6vw,58px)` | 560 | Fraunces, `-0.028em`, `line-height 1.04`, `text-wrap: balance` |
| Section h2 | `clamp(28px,3.4vw,44px)` | 560 | Fraunces, `-0.024em`, `line-height 1.08`, balance |
| Card h3 | 16–17px | 600–620 | Fraunces, `-0.01em` |
| Lede | 18px | 400 | Inter/Geist, `line-height 1.65` |
| Body/card copy | 13.5–15.5px | 400 | `line-height 1.6–1.65` |
| Eyebrow | 11px | 620 | mono, `+0.16em` uppercase, violet |
| Mono metadata | 9.5–11px | 500–650 | mono, uppercase tracking, muted |

Landing headings `.landing-page h1,h2,h3,.landing-brand` use `var(--font-serif)` with `-0.02em`.

## Spacing & layout

- 4px scale: 4,8,12,16,20,24,32,40,48,64,80,96.
- Eight rhythm: spacing multiples of 4 (preferred 8).
- Landing shell: `width: min(1160px, calc(100% - 48px))`, centered. Section padding-block `112px`. More space above a heading than below.
- Tight groups, generous separation: in-group 8–12px, between groups 24–48px.
- Landing grids: 3-col cards collapse to 1fr ≤900px; hero grid collapses ≤900px; nav links hidden ≤860px.

## Radius
`--radius-xs 4` · `--radius-sm 6` (badges) · `--radius-md 8` (buttons/inputs/default) · `--radius-lg 12` (cards) · `--radius-xl 14` (large cards/chat windows) · `--radius-2xl 16` (modals). No rounded-full on cards — 999px reserved for pills/badges/avatars/dots. No thick colored borders (1px max).

## Shadows
`--shadow-pop`: light `0 12px 32px rgba(18,10,40,.12), 0 2px 8px rgba(18,10,40,.06)`, dark `0 16px 44px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.4)` — reserved for floats (dialogs/modals/popovers/palette) ONLY. No decorative shadows; no hard-offset shadows. Panels: hairline + whisper of inner top light.

## Buttons
| Variant | Style |
|---|---|
| default (primary) | `bg var(--accent)`, `color var(--on-accent)`, hover `var(--accent-strong)` |
| outline | `border var(--border-strong)`, `bg var(--surface)`, hover `var(--hover)` |
| ghost | `color var(--fg-soft)`, hover `var(--hover)` |
| danger | `bg var(--danger)`, `color var(--bg)` |

Height 36px (sm 32px, lg 42px); font 13.5px/580; radius `--radius-md`(8px); press `translateY(1px)` / active scale. On landing, primary CTAs use the violet accent directly.

## Forms
Inputs: `bg var(--surface-2)`, `border 1px solid var(--border)`, radius `--radius-md`, `height 40–42px`. Focus: 2px `var(--ring)` offset 2px. Labels: mono 10.5px uppercase tracking (landing forms). Helper/trust text: 11.5–12.5px, muted.

## Landing system specifics (the redesign target)

- Nav: sticky 64px glass shell (hairline bottom edge). BrandMark + wordmark (17px/640 sans), links (13.5px/520 muted, hover violet): Product / Security / Roles / How it works. Right: ThemeToggle icon button + Sign in (ghost) + Request workspace (accent). Links hidden ≤860px.
- Hero: mono eyebrow with icon (`MULTI-TENANT · GROUNDED · INSTITUTION-FIRST` → actual copy "Multi-tenant · Grounded · Institution-first"), Fraunces H1 "Knowledge, *cited.* Not imagined." (em = violet italic), lede 18px, two CTAs (primary lg + text-link arrow), right column = GroundedChatMock.
- GroundedChatMock (code-drawn, reused in hero + grounding): chat window, `--radius-xl`, hairline strong border, `--shadow` whisper. Bar: 3 dots + "GROUNDED CHAT" + green "● ONLINE" (mono 10.5px). Body: user message (mono, right-aligned panel-2) → AI answer (accent-soft fill, accent-line border) with citation chip (BadgeCheck icon + `[1] Algorithms-lecture-03.pdf · p.18 · sim 0.94`, mono 10.5px) + meta pills (retrieved 4 chunks / reranked / verified). Footer: Search icon + placeholder text. Floating `hero-live-badge` top-right: pill with green dot + "RLS-scoped".
- Trust strip: panel bg, hairline top/bottom. Mono label "TRUSTED ACROSS DEPARTMENTS" + serif wordmarks (15px/560 muted): Université de Parakou, FASEG · UAC, ENEAM, FAST, ENAM + violet pill "N live" with green dot.
- Section heading pattern: eyebrow (mono violet uppercase) + Fraunces h2 + muted paragraph (max 620px). Split variant: grid 2col left head / right paragraph aligned end, right text-align.
- Cards language: opaque `--surface`, 1px `--border` hairline, `--radius-lg`, padding 26×24. Icon chips: 34–38px square, `--radius-10`, accent-line border, accent-soft bg, accent-strong icon.
- Isolation diagram: `.tenant-map` stack of 3 tenant-cards (mono name 12px, RLS pill tag, dashed top hairline, mono meta 10.5px: domain, region, tenant_id). Inactive card opacity 0.5.
- Sources rail: panel, header mono "RETRIEVED SOURCES" + count pill, rows of source-chips (doc 13px/620 + green score 0.9x mono 10px + citation chip).
- Signal cards: mono top label + accent icon, title 15px/640, body 12.5px, bar meter (accent 22% → hot bars accent, rounded 2px top).
- Request section: violet-panel hairline block; left = copy + form card (email+institution inputs + full-width lg accent CTA "Request workspace" + lock trust line "Setup is free for early adopters · no card required · your data stays in-region."); right = directory card (search input + up to 6 institution rows: serif initial mark in accent chip, name + slug, "Join" pill) + text-link "Don't see yours? Request it". 48px grid backdrop + violet radial mask.
- FAQ: details/summary rows in hairline cards; summary 15px/620 with ChevronDown rotating 180° on open.
- Footer: hairline top; brand + links (Security/Institutions/FAQ/Sign in 12.5px) + mono copyright `© 2026 AcademiAI · Multi-tenant · Grounded`.

## Motion
Page entrance `fade-in 0.22s cubic-bezier(.2,0,0,1)`; content `slide-up 0.22s`; scale-in dialogs 0.15s; hover hairline lift + `translateY(-2px)` on interactive cards (no-preference only); button press. Landing: scroll-reveal `.sr` (opacity 0→1, translateY 14px→0, 0.45s, staggered delays). All `prefers-reduced-motion` safe (durations 0.001s). One authored moment per page; no infinite animations except spinners/shimmer.

## Logo / brand assets
Official logo: `frontend/public/images/Logo/academiai_icon_light.webp` (full-colour on paper, used in light mode) and `academiai_icon_dark.png` (dark variant shown inside a soft white pill in dark mode). The BrandMark always renders one of these — NEVER generic "A", initials, emoji, or invented marks. Wordmark text "AcademiAI" (Fraunces on landing) sits beside the mark.

## Responsive
<768px single column + drawer; 768–1023px two-col; ≥1024px full; ≥1440px max 1280px content. Landing grids → 1fr ≤900px; nav links hidden ≤860px. Touch targets ≥44px. Never shrink desktop layouts; redesign for mobile.

## Accessibility
Semantic HTML (`nav`, `main`, `header`, `article`, `section`, `figure`, `details`). Visible focus rings 2px `var(--ring)`. `aria-label`s on icon-only controls, `aria-live` on dynamic content. Reduced motion respected. Contrast: body ≥4.5:1. Status never by color alone.

## Hard requirements for the reproduction
Use ONLY the tokens/colors/fonts/spacing above. One violet accent. Opaque hairlined panels. Mono metadata. Every AI answer shows its citations. Fraunces serif for landing headings + wordmarks. Include the exact official logo in nav and footer. No generic placeholders, no invented colors/fonts.
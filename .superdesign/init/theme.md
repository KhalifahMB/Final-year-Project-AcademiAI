# Theme & Design Tokens (AcademiAI frontend)

Single source of truth: **`frontend/src/styles/tokens.css`** (Tailwind v4 CSS-first, `@theme` + `:root` + `.dark`). `tailwind.config.js` mirrors tokens for shadcn intellisense only. `index.css` imports `tokens.css` → `base.css` → `components.css` → `landing.css` → `highlight.css`. **Change colors in `tokens.css`, never elsewhere.**

## Part 1 — Compact token summary (pass this to model context first)

### Palette — Light `:root`
| Token | oklch | Use |
|---|---|---|
| `--bg` | `0.985 0.003 85` | canvas (paper `#FAF9F6`) |
| `--surface` | `0.995 0.002 85` | cards/panels |
| `--surface-2` | `0.965 0.004 85` | inputs/secondary |
| `--hover` | `0.945 0.005 85` | hover |
| `--fg` | `0.2 0.018 285` | primary text |
| `--fg-soft` | `0.37 0.02 285` | secondary text |
| `--muted` | `0.53 0.015 285` | muted text |
| `--faint` | `0.7 0.01 285` | faintest |
| `--border` | `0.905 0.006 85` | hairlines |
| `--border-strong` | `0.83 0.008 85` | stronger |
| `--ring` | `0.577 0.195 282` | focus rings |
| `--accent` | `0.577 0.195 282` | **violet #6C5CE7** |
| `--accent-strong` | `0.5 0.19 282` | hover |
| `--accent-soft` | `0.945 0.028 282` | tint |
| `--accent-line` | `0.86 0.07 282` | accent hairline |
| `--on-accent` | `0.99 0.002 85` | text on accent |
| `--success` | `0.5 0.125 150` | data only |
| `--warn` | `0.5 0.115 80` | data only |
| `--danger` | `0.52 0.19 25` | destructive |
| `--info` | `0.52 0.11 245` | info |

### Palette — Dark `.dark`
`--bg 0.145 0.015 282` (near-black `#0B0B0E`), `--surface 0.19 0.018 282`, `--surface-2 0.235 0.02 282`, `--hover 0.27 0.022 282`, `--fg 0.97 0.008 282`, `--fg-soft 0.85 0.01 282`, `--muted 0.68 0.012 282`, `--faint 0.52 0.015 282`, `--border 0.275 0.02 282`, `--border-strong 0.35 0.025 282`, `--ring 0.72 0.17 282`, `--accent 0.72 0.17 282`, `--accent-strong 0.78 0.15 282`, `--accent-soft 0.32 0.07 282`, `--accent-line 0.42 0.09 282`, `--on-accent 0.98 0.005 282`, `--success 0.75 0.13 152`, `--warn 0.79 0.12 85`, `--danger 0.71 0.17 25`, `--info 0.73 0.11 245`.

### Landing aliases (`.landing-page`)
`--landing-ink`, `--landing-fg`, `--landing-faint`, `--landing-muted`, `--landing-paper`, `--landing-panel`, `--landing-panel-2`, `--landing-line`, `--landing-line-strong`, `--landing-accent`, `--landing-accent-strong`, `--landing-accent-soft`, `--landing-accent-line`, `--landing-on-accent`, `--landing-teal`, `--landing-success`, `--landing-coral` (danger-ish accent for error notes; dark: `0.72 0.16 25`), `--landing-section-pad: 112px`. All bind to app tokens.

### Typography
```css
--font-sans: 'Geist Variable','Geist',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Inter',ui-sans-serif,system-ui,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
--font-serif: 'Fraunces Variable','Fraunces',Georgia,'Times New Roman',serif;
--font-mono: 'Geist Mono',ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;
--font-display: var(--font-sans);
```
- Self-hosted via `@fontsource-variable` (Geist, Geist Mono, Fraunces) in `main.jsx`.
- **App:** body 15px/400/1.55; h1 30px/650/-0.02em; h2 19px/640; h3 15px/600; eyebrow 11px/600/+0.08em upper; buttons 13.5px; mono meta 11–12.5px.
- **Landing (editorial serif):** `.landing-page h1,h2,h3,.landing-brand` → `var(--font-serif)`, -0.02em. Hero h1 `clamp(34px,4.6vw,58px)`/560/-0.028em/1.04/balance; section h2 `clamp(28px,3.4vw,44px)`/560/-0.024em/1.08/balance; lede 18px/1.65; card copy 13.5–16px. Eyebrow = mono 11px/620/+0.16em uppercase violet.

### Spacing / layout
4px scale (4,8,12,16,20,24,32,40,48,64,80,96). `--topbar-h:56px`, `--sidebar-w:248px`, `--sidebar-w-collapsed:60px`. Landing shell `width: min(1160px, calc(100% - 48px))`. Section padding `--landing-section-pad:112px`.

### Radius
`--radius-xs 4px` · `--radius-sm 6px` (badges) · `--radius-md 8px` (buttons/inputs) · `--radius-lg 12px` (cards) · `--radius-xl 14px` (large cards) · `--radius-2xl 16px` (modals). **No rounded-full on cards** (999px only pills/badges/avatars/dots). No thick colored borders.

### Shadows
`--shadow-pop` (light: `0 12px 32px rgba(18,10,40,.12), 0 2px 8px rgba(18,10,40,.06)`; dark: `0 16px 44px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.4)`) — **only for popovers/dropdowns/modals**. No decorative shadows. Neomorph inner `inset 0 1px 0 var(--fg) 6%` + `inset 0 -1px 0 var(--fg) 9%` reserved for stat/trend panels + hero objects only.

### Glass recipes
- Shell (topbar/nav): `background: color-mix(in oklab, var(--surface) 80%, transparent); backdrop-filter: blur(16px) saturate(150%)`.
- Overlays: 90% tint + blur(22px); `.glass-card-tint` = 86% tint.
- **Never glass behind long-form text or dense tables; landing panels are opaque.**

### Motion
`fade-in 0.22s`, `slide-up 0.22s cubic-bezier(.2,0,0,1)`, `scale-in 0.15s`, `slide-right 0.22s`, `pulse-soft`, `shimmer`. Landing has scroll-reveal (`.sr`) + staggered hero entrance. All `prefers-reduced-motion` safe. One authored moment per page.

### Textures (landing)
`.texture-grain` (SVG feTurbulence, 5%/8% dark, `mix-blend-mode: overlay`), `.texture-grid` (48px fg 6% grid), `.texture-grid--faint` (4%). Hero uses a faint violet radial glow (`color-mix accent 7–12%`) + 48px grid with `mask-image` fade.

### Design rules (must hold for any redesign)
1. **Single accent economy** — one violet (#6C5CE7) for actions/links/active/focus. Never a second hue. Status colors are data, never decoration.
2. **Hard-surface hairline panels** — opaque `--surface` + 1px hairline. Glass only on shell/overlays.
3. **No purple-blue gradient everything; no giant blobs; no neomorph on inputs/rows/buttons.**
4. **Landing voice = Fraunces + Inter; app = Geist.** Serif is landing/auth only.
5. **Token-driven both themes** — no hardcoded hues.
6. **Every AI answer shows its citations** (chat mocks always render grounded sources).
7. No icon above *every* heading, no cards-inside-cards, no emoji icons, no meaningless stats, no tiny low-contrast text, no huge empty heroes, no excessive animation.

### Responsive
<768px single column + drawer; 768–1023px two-column; ≥1024px sidebar; ≥1440px max 1280px. **Landing grids collapse to 1fr ≤900px; nav links hidden ≤860px.** Touch targets ≥44px. Never shrink desktop layouts.

## Part 2 — Source file references (read these for full raw dumps)

The design flow passes these files as `--context-file` when regenerating a page; they contain the full token + component source:
- `frontend/src/styles/tokens.css` — full `@theme`, `:root`, `.dark`, material + texture tokens (297 lines).
- `frontend/src/styles/base.css` — reset, typography, focus rings, keyframes, reduced-motion (195 lines).
- `frontend/src/styles/components.css` — `.btn*`, `.card*`, `.badge*`, `.eyebrow`, navigation, tables, prose (608 lines).
- `frontend/src/styles/landing.css` — complete landing/auth system, all `.landing-*` classes (1620 lines).
- `frontend/src/index.css` — stylesheet entry (imports the above).
- `frontend/tailwind.config.js` — shadcn color map (token mirrors only).
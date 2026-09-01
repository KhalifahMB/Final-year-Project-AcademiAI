# Frontend stack

- **React 19** + **Vite 8** (build) + **Vitest 4** (tests) + **oxlint** (lint)
- **Tailwind CSS v4** — CSS-first theme via `src/index.css` (oklch tokens); no `tailwind.config.js`
- **shadcn/ui JavaScript primitives** (Radix UI based): Button, Input, Label, Card, Alert, Badge, Textarea, Separator, Select, Dialog, AlertDialog, DropdownMenu, Checkbox, Tabs, Table, Tooltip, Popover
- **TanStack Query** for server state + caching
- **React Hook Form + Zod** for validated forms
- **React Router** role-gated routes (student / lecturer / tenant_admin / superuser)
- **axios** JWT client (`src/services/api.js`) wrapping the Django DRF backend
- **TipTap** rich-text editor (notes), **react-markdown + KaTeX** (assistant responses)
- **Recharts** dashboards, **lucide-react** icons, **sonner** toasts, **tiptap** notes

## Screens

dashboard · courses · resources · chat (AI assistant) · quizzes · notes · bookmarks · progress · profile · admin (users, quizzes, audit) · platform console (tenants, audit) · auth (login, signup, verify, password reset)

## Shared components (`src/components/shared/`)

- `PageHeader` — consistent page title/description
- `Pagination` — client-side pagination control
- `AsyncState` — `LoadingState` / `ErrorState` / `EmptyStateFull`
- `ConfirmDialog` — accessible confirmations replacing all `window.confirm()`
- `StatusBadge`, `EmptyState`, `SkeletonRows`

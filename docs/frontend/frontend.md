# Frontend Documentation

## Stack

- React
- Vite
- JavaScript
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- Axios or a similarly isolated HTTP client
- Form validation library as selected during implementation

## Design system

shadcn/ui provides reusable accessible components while Tailwind CSS controls layout and utility styling.

The implementation should keep reusable primitives in a central UI area and feature-specific compositions in domain folders.

## Structure

```text
src/
  main.jsx
  App.jsx
  components/
    ui/            # shadcn/ui + Radix primitives
    shared/        # cross-app components (StatCard, EmptyState, …)
    layout/        # AppShell, nav, headers
    common/        # CommandPalette, ForbiddenPage, …  (app-wide helpers)
    agent/         # FloatingAgent + agent panels
    chat/          # chat-specific compositions
    notifications/ # notification UI
    resources/     # resource-specific compositions
  context/         # React contexts + providers — NEVER co-located with a hook
  hooks/           # use* hooks — NEVER co-located with a context
  pages/           # route screens (dashboard/, admin/, platform/, …)
  routes/          # role-gated route definitions + guards
  services/        # axios client, API wrappers, response contracts
  lib/             # react-query keys/options, session flag, sentry, theme
  styles/          # index.css (Tailwind v4 tokens), fonts, etc.
  test/            # vitest suites
```

## Structure rules

- Contexts and providers live in `src/context/`; hooks live in `src/hooks/`. Never define a `createContext` and a `use*` hook in the same file.
- API clients and their response contracts live in `src/services/`; components never call `axios`/fetch directly.
- Reusable primitives stay in `src/components/ui/` and `src/components/shared/`; feature-specific compositions go in domain subfolders.

## Routing

Protected routes must require authentication. Role-sensitive routes must additionally check authorization.

## Data fetching

TanStack Query should manage:
- server state
- caching
- invalidation
- loading/error states
- mutation lifecycle

Do not place server data unnecessarily into global UI state.

## API client

Centralize:
- base URL
- JWT handling
- refresh behavior
- request IDs if used
- standardized API errors

## Main screens

### Student
- Dashboard
- My Programme
- My Courses
- Course Details
- Resources
- AI Assistant
- Quiz
- Notes
- Bookmarks
- Progress
- Profile

### Lecturer
- Dashboard
- Assigned Courses
- Course Resources
- Upload Resource
- Quiz Management
- Profile

### Admin
- Dashboard
- Users
- Faculties
- Departments
- Programmes
- Courses
- Course Offerings
- Enrollments
- Audit Logs
- Tenant settings

## Accessibility

Use semantic HTML, keyboard-accessible controls, visible focus states, appropriate labels, sufficient contrast, and accessible dialogs/forms.

## Error handling

Every API mutation must provide:
- loading state
- success feedback
- validation feedback
- recoverable error message

Do not expose raw server stack traces to users.

# Frontend stack

## Toolchain

- **React 19** + **Vite 8** (build) + **Vitest 4** (tests) + **oxlint** (lint)
- **Tailwind CSS v4** — CSS-first theme via `src/index.css` (oklch tokens); no `tailwind.config.js`
- **shadcn/ui JavaScript primitives** (Radix UI based): Button, Input, Label, Card, Alert, Badge, Textarea, Separator, Select, Dialog, AlertDialog, DropdownMenu, Checkbox, Tabs, Table, Tooltip, Popover
- **TanStack Query** for server state + caching
- **React Hook Form + Zod** for validated forms
- **React Router** role-gated routes (student / lecturer / tenant_admin / superuser)
- **axios** JWT client (`src/services/api.js`) wrapping the Django DRF backend
- **TipTap** rich-text editor (notes), **react-markdown + KaTeX** (assistant responses)
- **Recharts** dashboards, **lucide-react** icons, **sonner** toasts

---

## Screens

### Marketing

| File | Route | Description |
|------|-------|-------------|
| `LandingPage.jsx` | `/` | Public marketing landing — hero, product principles, feature sections, institution directory, CTA |

### Auth

| File | Route | Description |
|------|-------|-------------|
| `LoginPage.jsx` | `/login` | Email + password login |
| `SignupPage.jsx` | `/signup` | Student self-registration (programme selector, institution picker) |
| `VerifyEmailPage.jsx` | `/verify-email/:token` | Email verification callback |
| `PasswordResetPage.jsx` | `/password-reset/:token` | Password reset form |
| `RequestInstitutionPage.jsx` | `/request-institution` | Public form to request a new university workspace |

### Dashboard (`pages/dashboard/`)

| File | Route | Description |
|------|-------|-------------|
| `DashboardPage.jsx` | `/dashboard` | Role-aware wrapper — delegates to student or lecturer sub-view |
| `StudentDashboard.jsx` | (child) | Enrolled courses, recent chats, recent materials |
| `LecturerDashboard.jsx` | (child) | Pipeline stats, recent uploads, cohort signals |
| `DashboardPage.helpers.jsx` | — | Shared stat formatting and date helpers |

### Student

| File | Route | Description |
|------|-------|-------------|
| `MyCoursesPage.jsx` | `/my-courses` | Enrolled courses list |
| `MyProgrammePage.jsx` | `/my-programme` | Programme structure, enrolled offerings |
| `CoursesPage.jsx` | `/courses` | Course catalogue (browse by faculty/department) |
| `CourseDetailPage.jsx` | `/courses/:id` | Course detail — materials, AI tutor entry, enrolled students |
| `ResourcesPage.jsx` | `/resources` | Resource browser (filtered by course, type, visibility) |
| `UploadResourcePage.jsx` | `/resources/upload` | Upload wizard — drag-drop, metadata, visibility, processing status |
| `ChatPage.jsx` | `/chat` | AI assistant — role agents, streaming SSE, file attachments, citations |
| `CalendarPage.jsx` | `/calendar` | Layered calendar — plans, lectures, exams, office hours, events |
| `PlansPage.jsx` | `/plans` | Study planner — plan list, create from template or agent |
| `PlanDetailPage.jsx` | `/plans/:id` | Plan detail — milestones, tasks, calendar sync |
| `QuizzesPage.jsx` | `/quizzes` | Quiz list — available and completed |
| `QuizTakePage.jsx` | `/quizzes/:id/take` | Quiz taking — timed, auto-submit, results |
| `NotesPage.jsx` | `/notes` | Rich-text notes (TipTap editor) |
| `BookmarksPage.jsx` | `/bookmarks` | Saved resources |
| `ProgressPage.jsx` | `/progress` | Concept-level mastery progress |
| `ProfilePage.jsx` | `/profile` | Name, avatar, password, agent preferences, notification prefs |

### Lecturer

| File | Route | Description |
|------|-------|-------------|
| `AssignedCoursesPage.jsx` | `/assigned-courses` | Courses assigned to this lecturer |

### Admin (`pages/admin/`) — tenant_admin role

| File | Route | Description |
|------|-------|-------------|
| `AdminDashboardPage.jsx` | `/admin` | Tenant admin dashboard — aggregate stats, recent uploads |
| `AdminCoursesPage.jsx` | `/admin/courses` | Course management (CRUD) |
| `CourseManagePage.jsx` | `/admin/courses/:id` | Course detail — offerings, enrolled students, materials |
| `AdminUsersPage.jsx` | `/admin/users` | User management — role changes, search |
| `AdminQuizzesPage.jsx` | `/admin/quizzes` | Quiz management — review, publish, delete |
| `AdminTemplatesPage.jsx` | `/admin/templates` | Plan and quiz template management |
| `AdminAuditPage.jsx` | `/admin/audit` | Tenant audit log viewer |
| `TenantStructurePage.jsx` | `/admin/structure` | Faculty → department → programme → course hierarchy |
| `FacultyDetailPage.jsx` | `/admin/faculty/:id` | Faculty detail — departments, programmes |
| `DepartmentDetailPage.jsx` | `/admin/department/:id` | Department detail — programmes, courses |

### Platform (`pages/platform/`) — superuser only

| File | Route | Description |
|------|-------|-------------|
| `PlatformConsolePage.jsx` | `/platform` | Cross-tenant overview — tenant list, system health |
| `TenantsPage.jsx` | `/platform/tenants` | Tenant management — create, suspend, reactivate |
| `TenantDetailPage.jsx` | `/platform/tenants/:id` | Tenant detail — settings, users, stats |
| `TenantLogsPage.jsx` | `/platform/tenants/:id/logs` | Tenant request log viewer |
| `RequestsPage.jsx` | `/platform/requests` | Sign-up request queue — approve/reject with plan assignment |
| `AnnouncementsPage.jsx` | `/platform/announcements` | Platform-wide announcement management |
| `AnalyticsPage.jsx` | `/platform/analytics` | Cross-tenant analytics charts |
| `SystemHealthPage.jsx` | `/platform/health` | Infrastructure health — DB, Redis, RabbitMQ, storage |
| `AuditLogPage.jsx` | `/platform/audit` | Platform-wide audit log |

---

## Shared components (`src/components/shared/`)

| Component | Description |
|-----------|-------------|
| `AsyncState.jsx` | `LoadingState` / `ErrorState` / `EmptyStateFull` wrappers |
| `Avatar.jsx` | User avatar with initials fallback |
| `AvatarPicker.jsx` | Avatar selection grid (predefined + upload) |
| `AiInsightCard.jsx` | Formatted AI insight display card |
| `BrandMark.jsx` | Logo + wordmark with light/dark variants |
| `ConfirmDialog.jsx` | Accessible confirmation replacing all `window.confirm()` |
| `EmptyState.jsx` | Empty state with icon, title, description, action |
| `EntityDialog.jsx` | Generic create/edit dialog (used across admin pages) |
| `OnlineStatus.jsx` | WebSocket-based online/offline indicator |
| `PageHeader.jsx` | Consistent page title + description |
| `Pagination.jsx` | Client-side pagination control |
| `SearchableSelect.jsx` | Async search dropdown (used for course/user pickers) |
| `SkeletonRows.jsx` | Loading skeleton placeholder |
| `StatCard.jsx` | Metric card with label, value, optional trend |
| `StatTile.jsx` | Compact stat tile for dashboard grids |
| `StatusBadge.jsx` | Status pill with color coding |
| `TemplateEditorDialog.jsx` | Plan/quiz template create/edit dialog |
| `ThemeToggle.jsx` | Light/dark mode toggle |

---

## Role-gating

Routes are protected by role in `AppShell.jsx`:

| Role | Accessible sections |
|------|-------------------|
| `student` | Dashboard, My Courses, My Programme, Courses, Resources, Chat, Calendar, Plans, Quizzes, Notes, Bookmarks, Progress, Profile |
| `lecturer` | All student routes + Assigned Courses |
| `tenant_admin` | All lecturer routes + Admin (users, courses, quizzes, templates, audit, structure) |
| `superuser` | All routes + Platform Console (tenants, requests, announcements, analytics, health, audit) |

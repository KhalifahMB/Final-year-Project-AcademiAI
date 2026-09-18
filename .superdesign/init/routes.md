# Routes (AcademiAI frontend)

React Router v7 config-based routing. Entry: `frontend/src/routes/AppRoutes.jsx` composes three route arrays: `publicRoutes`, `tenantRoutes`, `platformRoutes`.

## AppRoutes.jsx (full)

```jsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { Guard, SuspenseShell } from './guards';
import { publicRoutes } from './publicRoutes';
import { tenantRoutes } from './tenantRoutes';
import { platformRoutes } from './platformRoutes';
import { NotFoundPage } from '@/components/common/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      {publicRoutes.map(({ path, Page }) => (
        <Route
          key={path}
          path={path}
          element={
            <SuspenseShell>
              <Page />
            </SuspenseShell>
          }
        />
      ))}
      {tenantRoutes.map(({ path, Page, roles, redirect }) => {
        if (redirect) {
          return (
            <Route
              key={path}
              path={path}
              element={<Navigate to={redirect} replace />}
            />
          );
        }
        return (
          <Route
            key={path}
            path={path}
            element={
              <Guard roles={roles}>
                <Page />
              </Guard>
            }
          />
        );
      })}
      {platformRoutes.map(({ path, Page }) => (
        <Route
          key={path}
          path={path}
          element={
            <Guard requireSuperuser>
              <Page />
            </Guard>
          }
        />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

## Public routes (`frontend/src/routes/publicRoutes.js`)

| Path | Page component | Wrapper |
|------|---------------|---------|
| `/` | `src/pages/LandingPage.jsx` | SuspenseShell |
| `/login` | `src/pages/LoginPage.jsx` | SuspenseShell |
| `/signup` | `src/pages/SignupPage.jsx` | SuspenseShell |
| `/verify-email` | `src/pages/VerifyEmailPage.jsx` | SuspenseShell |
| `/password-reset` | `src/pages/PasswordResetPage.jsx` | SuspenseShell |
| `/request-institution` | `src/pages/RequestInstitutionPage.jsx` | SuspenseShell |

## Tenant routes (`frontend/src/routes/tenantRoutes.js`)
Guarded by `ProtectedRoute`. Key paths:
- `/dashboard` — `DashboardPage` (role-home: Student/Lecturer/Admin dashboards)
- `/chat`, `/resources`, `/upload-resource`, `/quizzes`, `/quiz/:id`
- `/courses`, `/courses/:id`, `/my-courses`, `/my-programme`, `/assigned-courses`
- `/notes`, `/calendar`, `/bookmarks`, `/progress`, `/plans`, `/plans/:id`, `/profile`
- `/admin/*` (AdminUsers, AdminQuizzes, AdminTemplates, AdminDashboard, AdminAudit, TenantLogs, TenantStructure, FacultyDetail, DepartmentDetail, CourseManage, AdminCourses, CalendarUpload)

## Platform routes (`frontend/src/routes/platformRoutes.js`)
Superuser-only:
- `/platform` — `PlatformConsolePage`
- `/platform/tenants`, `/platform/tenants/:id`, `/platform/requests`
- `/platform/analytics`, `/platform/health`, `/platform/audit`, `/platform/announcements`

## Page loads (`frontend/src/routes/pages.js`)
All pages lazy-imported via `lazy(() => import('@/pages/...'))` for code splitting.

## Page summaries
- **LandingPage** (`/`): marketing landing — nav, hero (Fraunces headline + grounded chat mock), trust strip (live institution count), problem cards, 6-feature platform grid, 3-step how-it-works, hard-isolation tenant diagram, grounding demo (chat + sources rail), role agents (student/lecturer/admin), cohort signals (bar meters), testimonials, request form + live institution directory, FAQ, footer.
- **LoginPage / SignupPage / PasswordResetPage / VerifyEmailPage**: auth pages using the `landing-auth` split layout (proof + tutor mock left, glass card right), landing.css system.
- **RequestInstitutionPage**: institutional onboarding request.
- **DashboardPage**: role-split home (StudentDashboard / LecturerDashboard / AdminDashboard).
- **PlatformConsolePage**: superuser cross-tenant ops.
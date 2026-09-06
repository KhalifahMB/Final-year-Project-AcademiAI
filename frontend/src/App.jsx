import { Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
  RouteLoading,
  NotFoundPage,
  InAppNotFound,
} from '@/components/common/NotFoundPage';
import ForbiddenPage from '@/components/common/ForbiddenPage';
import {
  EVERYONE,
  STAFF,
  STUDENT_ONLY,
  TENANT_ADMIN_ONLY,
  roleHome,
} from '@/lib/access';

// Lazy-load every route so the initial bundle stays small.
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage'));

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const ResourcesPage = lazy(() => import('@/pages/ResourcesPage'));
const UploadResourcePage = lazy(() => import('@/pages/UploadResourcePage'));
const QuizzesPage = lazy(() => import('@/pages/QuizzesPage'));
const QuizTakePage = lazy(() => import('@/pages/QuizTakePage'));
const CoursesPage = lazy(() => import('@/pages/CoursesPage'));
const CourseDetailPage = lazy(() => import('@/pages/CourseDetailPage'));
const MyCoursesPage = lazy(() => import('@/pages/MyCoursesPage'));
const MyProgrammePage = lazy(() => import('@/pages/MyProgrammePage'));
const AssignedCoursesPage = lazy(() => import('@/pages/AssignedCoursesPage'));
const NotesPage = lazy(() => import('@/pages/NotesPage'));
const BookmarksPage = lazy(() => import('@/pages/BookmarksPage'));
const ProgressPage = lazy(() => import('@/pages/ProgressPage'));
const PlansPage = lazy(() => import('@/pages/PlansPage'));
const PlanDetailPage = lazy(() => import('@/pages/PlanDetailPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const RequestInstitutionPage = lazy(
  () => import('@/pages/RequestInstitutionPage'),
);

const AdminAuditPage = lazy(() => import('@/pages/AdminAuditPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminQuizzesPage = lazy(() => import('@/pages/AdminQuizzesPage'));
const AdminTemplatesPage = lazy(() => import('@/pages/AdminTemplatesPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const TenantStructurePage = lazy(
  () => import('@/pages/admin/TenantStructurePage'),
);
const FacultyDetailPage = lazy(() => import('@/pages/admin/FacultyDetailPage'));
const DepartmentDetailPage = lazy(
  () => import('@/pages/admin/DepartmentDetailPage'),
);
const CourseManagePage = lazy(() => import('@/pages/admin/CourseManagePage'));
const AdminCoursesPage = lazy(() => import('@/pages/admin/AdminCoursesPage'));
const TenantLogsPage = lazy(() => import('@/pages/TenantLogsPage'));

const PlatformConsolePage = lazy(() => import('@/pages/PlatformConsolePage'));
const PlatformTenantsPage = lazy(() => import('@/pages/platform/TenantsPage'));
const PlatformTenantDetailPage = lazy(
  () => import('@/pages/platform/TenantDetailPage'),
);
const PlatformAnalyticsPage = lazy(
  () => import('@/pages/platform/AnalyticsPage'),
);
const PlatformSystemHealthPage = lazy(
  () => import('@/pages/platform/SystemHealthPage'),
);
const PlatformAuditLogPage = lazy(
  () => import('@/pages/platform/AuditLogPage'),
);
const PlatformAnnouncementsPage = lazy(
  () => import('@/pages/platform/AnnouncementsPage'),
);
const PlatformRequestsPage = lazy(
  () => import('@/pages/platform/RequestsPage'),
);

function ProtectedRoute({ children, roles, requireSuperuser }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoading label="Loading your workspace…" />;
  if (!user) return <Navigate to="/login" replace />;

  // Platform console is superuser-only: anyone else lands on their own home.
  if (requireSuperuser) {
    if (user.is_superuser) return children;
    return <Navigate to={roleHome(user)} replace />;
  }

  // Every other route is tenant-scoped. Platform operators have no tenant, so
  // every tenant API would 4xx — send them to their console before mounting.
  if (user.is_superuser) return <Navigate to="/platform" replace />;

  // Signed-in user with no tenant yet must onboard into an institution.
  if (!user.tenant) return <Navigate to="/request-institution" replace />;

  // Wrong role for this page: show an explicit 403 rather than erroring.
  if (roles && !roles.includes(user.role))
    return <Navigate to="/forbidden" replace />;
  return children;
}

// eslint-disable-next-line react-refresh/only-export-components
function _ProtectedNotFound() {
  return (
    <ProtectedRoute>
      <InAppNotFound />
    </ProtectedRoute>
  );
}

function SuspenseShell({ children }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

// Tiny helper to DRY up <SuspenseShell><ProtectedRoute>...</ProtectedRoute></SuspenseShell>
function Guard({ children, ...guardProps }) {
  return (
    <SuspenseShell>
      <ProtectedRoute {...guardProps}>{children}</ProtectedRoute>
    </SuspenseShell>
  );
}

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" closeButton />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route
            path="/"
            element={
              <SuspenseShell>
                <LandingPage />
              </SuspenseShell>
            }
          />
          <Route
            path="/login"
            element={
              <SuspenseShell>
                <LoginPage />
              </SuspenseShell>
            }
          />
          <Route
            path="/signup"
            element={
              <SuspenseShell>
                <SignupPage />
              </SuspenseShell>
            }
          />
          <Route
            path="/verify-email"
            element={
              <SuspenseShell>
                <VerifyEmailPage />
              </SuspenseShell>
            }
          />
          <Route
            path="/password-reset"
            element={
              <SuspenseShell>
                <PasswordResetPage />
              </SuspenseShell>
            }
          />
          <Route
            path="/request-institution"
            element={
              <SuspenseShell>
                <RequestInstitutionPage />
              </SuspenseShell>
            }
          />

          {/* App */}
          <Route
            path="/dashboard"
            element={
              <Guard roles={EVERYONE}>
                <DashboardPage />
              </Guard>
            }
          />

          <Route
            path="/courses"
            element={
              <Guard roles={EVERYONE}>
                <CoursesPage />
              </Guard>
            }
          />
          <Route
            path="/courses/:id"
            element={
              <Guard roles={EVERYONE}>
                <CourseDetailPage />
              </Guard>
            }
          />
          <Route
            path="/my-courses"
            element={
              <Guard roles={STUDENT_ONLY}>
                <MyCoursesPage />
              </Guard>
            }
          />
          <Route
            path="/my-programme"
            element={
              <Guard roles={STUDENT_ONLY}>
                <MyProgrammePage />
              </Guard>
            }
          />
          <Route
            path="/assigned-courses"
            element={
              <Guard roles={STAFF}>
                <AssignedCoursesPage />
              </Guard>
            }
          />

          <Route
            path="/resources"
            element={
              <Guard roles={EVERYONE}>
                <ResourcesPage />
              </Guard>
            }
          />
          <Route
            path="/resources/upload"
            element={
              <Guard roles={EVERYONE}>
                <UploadResourcePage />
              </Guard>
            }
          />

          <Route
            path="/chat"
            element={
              <Guard roles={EVERYONE}>
                <ChatPage />
              </Guard>
            }
          />

          <Route
            path="/quizzes"
            element={
              <Guard roles={EVERYONE}>
                <QuizzesPage />
              </Guard>
            }
          />
          <Route
            path="/quizzes/:id/take"
            element={
              <Guard roles={EVERYONE}>
                <QuizTakePage />
              </Guard>
            }
          />
          <Route
            path="/admin/quizzes"
            element={
              <Guard roles={STAFF}>
                <AdminQuizzesPage />
              </Guard>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <AdminDashboardPage />
              </Guard>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <AdminUsersPage />
              </Guard>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <AdminAuditPage />
              </Guard>
            }
          />
          <Route
            path="/admin/tenant"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <TenantStructurePage />
              </Guard>
            }
          />
          <Route
            path="/admin/faculties/:id"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <FacultyDetailPage />
              </Guard>
            }
          />
          <Route
            path="/admin/departments/:id"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <DepartmentDetailPage />
              </Guard>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <AdminCoursesPage />
              </Guard>
            }
          />
          <Route
            path="/admin/courses/:id"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <CourseManagePage />
              </Guard>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <TenantLogsPage />
              </Guard>
            }
          />
          <Route
            path="/admin/templates"
            element={
              <Guard roles={TENANT_ADMIN_ONLY}>
                <AdminTemplatesPage />
              </Guard>
            }
          />

          {/* Platform (superuser) */}
          <Route
            path="/platform"
            element={
              <Guard requireSuperuser>
                <PlatformConsolePage />
              </Guard>
            }
          />
          <Route
            path="/platform/tenants"
            element={
              <Guard requireSuperuser>
                <PlatformTenantsPage />
              </Guard>
            }
          />
          <Route
            path="/platform/tenants/:id"
            element={
              <Guard requireSuperuser>
                <PlatformTenantDetailPage />
              </Guard>
            }
          />
          <Route
            path="/platform/requests"
            element={
              <Guard requireSuperuser>
                <PlatformRequestsPage />
              </Guard>
            }
          />
          <Route
            path="/platform/analytics"
            element={
              <Guard requireSuperuser>
                <PlatformAnalyticsPage />
              </Guard>
            }
          />
          <Route
            path="/platform/health"
            element={
              <Guard requireSuperuser>
                <PlatformSystemHealthPage />
              </Guard>
            }
          />
          <Route
            path="/platform/audit"
            element={
              <Guard requireSuperuser>
                <PlatformAuditLogPage />
              </Guard>
            }
          />
          <Route
            path="/platform/announcements"
            element={
              <Guard requireSuperuser>
                <PlatformAnnouncementsPage />
              </Guard>
            }
          />

          <Route
            path="/notes"
            element={
              <Guard roles={EVERYONE}>
                <NotesPage />
              </Guard>
            }
          />
          <Route
            path="/bookmarks"
            element={
              <Guard roles={EVERYONE}>
                <BookmarksPage />
              </Guard>
            }
          />
          <Route
            path="/progress"
            element={
              <Guard roles={EVERYONE}>
                <ProgressPage />
              </Guard>
            }
          />
          <Route
            path="/plans"
            element={
              <Guard roles={EVERYONE}>
                <PlansPage />
              </Guard>
            }
          />
          <Route
            path="/plans/:id"
            element={
              <Guard roles={EVERYONE}>
                <PlanDetailPage />
              </Guard>
            }
          />
          <Route
            path="/settings"
            element={
              <Guard roles={EVERYONE}>
                <ProfilePage />
              </Guard>
            }
          />
          <Route
            path="/profile"
            element={<Navigate to="/settings" replace />}
          />

          <Route
            path="/forbidden"
            element={
              <Guard>
                <ForbiddenPage />
              </Guard>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

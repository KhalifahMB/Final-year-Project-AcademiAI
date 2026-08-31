import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { RouteLoading, NotFoundPage, InAppNotFound } from '@/components/common/NotFoundPage';

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
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const RequestInstitutionPage = lazy(() => import('@/pages/RequestInstitutionPage'));

const AdminAuditPage = lazy(() => import('@/pages/AdminAuditPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminQuizzesPage = lazy(() => import('@/pages/AdminQuizzesPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const TenantStructurePage = lazy(() => import('@/pages/admin/TenantStructurePage'));
const FacultyDetailPage = lazy(() => import('@/pages/admin/FacultyDetailPage'));
const DepartmentDetailPage = lazy(() => import('@/pages/admin/DepartmentDetailPage'));
const CourseManagePage = lazy(() => import('@/pages/admin/CourseManagePage'));
const AdminCoursesPage = lazy(() => import('@/pages/admin/AdminCoursesPage'));

const PlatformConsolePage = lazy(() => import('@/pages/PlatformConsolePage'));
const PlatformTenantsPage = lazy(() => import('@/pages/platform/TenantsPage'));
const PlatformTenantDetailPage = lazy(() => import('@/pages/platform/TenantDetailPage'));
const PlatformAnalyticsPage = lazy(() => import('@/pages/platform/AnalyticsPage'));
const PlatformSystemHealthPage = lazy(() => import('@/pages/platform/SystemHealthPage'));
const PlatformAuditLogPage = lazy(() => import('@/pages/platform/AuditLogPage'));
const PlatformAnnouncementsPage = lazy(() => import('@/pages/platform/AnnouncementsPage'));
const PlatformRequestsPage = lazy(() => import('@/pages/platform/RequestsPage'));

function ProtectedRoute({ children, roles, requireSuperuser, blockSuperuser }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoading label="Loading your workspace…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (requireSuperuser && !user.is_superuser) return <Navigate to="/admin/dashboard" replace />;
  if (blockSuperuser && user.is_superuser) return <Navigate to="/platform" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
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
          <Route path="/" element={<SuspenseShell><LandingPage /></SuspenseShell>} />
          <Route path="/login" element={<SuspenseShell><LoginPage /></SuspenseShell>} />
          <Route path="/signup" element={<SuspenseShell><SignupPage /></SuspenseShell>} />
          <Route path="/verify-email" element={<SuspenseShell><VerifyEmailPage /></SuspenseShell>} />
          <Route path="/password-reset" element={<SuspenseShell><PasswordResetPage /></SuspenseShell>} />
          <Route path="/request-institution" element={<SuspenseShell><RequestInstitutionPage /></SuspenseShell>} />

          {/* App */}
          <Route path="/dashboard" element={<Guard blockSuperuser><DashboardPage /></Guard>} />

          <Route path="/courses" element={<Guard><CoursesPage /></Guard>} />
          <Route path="/courses/:id" element={<Guard><CourseDetailPage /></Guard>} />
          <Route path="/my-courses" element={<Guard><MyCoursesPage /></Guard>} />
          <Route path="/my-programme" element={<Guard><MyProgrammePage /></Guard>} />
          <Route
            path="/assigned-courses"
            element={<Guard roles={['lecturer', 'tenant_admin']}><AssignedCoursesPage /></Guard>}
          />

          <Route path="/resources" element={<Guard><ResourcesPage /></Guard>} />
          <Route path="/resources/upload" element={<Guard><UploadResourcePage /></Guard>} />

          <Route path="/chat" element={<Guard><ChatPage /></Guard>} />

          <Route path="/quizzes" element={<Guard><QuizzesPage /></Guard>} />
          <Route path="/quizzes/:id/take" element={<Guard><QuizTakePage /></Guard>} />
          <Route
            path="/admin/quizzes"
            element={<Guard roles={['lecturer', 'tenant_admin']}><AdminQuizzesPage /></Guard>}
          />

          <Route
            path="/admin/dashboard"
            element={<Guard roles={['tenant_admin']} blockSuperuser><AdminDashboardPage /></Guard>}
          />
          <Route
            path="/admin/users"
            element={<Guard roles={['tenant_admin']} blockSuperuser><AdminUsersPage /></Guard>}
          />
          <Route
            path="/admin/audit"
            element={<Guard roles={['tenant_admin']} blockSuperuser><AdminAuditPage /></Guard>}
          />
          <Route
            path="/admin/tenant"
            element={<Guard roles={['tenant_admin']} blockSuperuser><TenantStructurePage /></Guard>}
          />
          <Route
            path="/admin/faculties/:id"
            element={<Guard roles={['tenant_admin']} blockSuperuser><FacultyDetailPage /></Guard>}
          />
          <Route
            path="/admin/departments/:id"
            element={<Guard roles={['tenant_admin']} blockSuperuser><DepartmentDetailPage /></Guard>}
          />
          <Route
            path="/admin/courses"
            element={<Guard roles={['tenant_admin']} blockSuperuser><AdminCoursesPage /></Guard>}
          />
          <Route
            path="/admin/courses/:id"
            element={<Guard roles={['tenant_admin']} blockSuperuser><CourseManagePage /></Guard>}
          />

          {/* Platform (superuser) */}
          <Route
            path="/platform"
            element={<Guard roles={['tenant_admin']} requireSuperuser><PlatformConsolePage /></Guard>}
          />
          <Route
            path="/platform/tenants"
            element={<Guard roles={['tenant_admin']} requireSuperuser><PlatformTenantsPage /></Guard>}
          />
          <Route
            path="/platform/tenants/:id"
            element={<Guard roles={['tenant_admin']} requireSuperuser><PlatformTenantDetailPage /></Guard>}
          />
          <Route
            path="/platform/requests"
            element={<Guard roles={['tenant_admin']} requireSuperuser><PlatformRequestsPage /></Guard>}
          />
          <Route
            path="/platform/analytics"
            element={<Guard roles={['tenant_admin']} requireSuperuser><PlatformAnalyticsPage /></Guard>}
          />
          <Route
            path="/platform/health"
            element={<Guard roles={['tenant_admin']} requireSuperuser><PlatformSystemHealthPage /></Guard>}
          />
          <Route
            path="/platform/audit"
            element={<Guard roles={['tenant_admin']} requireSuperuser><PlatformAuditLogPage /></Guard>}
          />
          <Route
            path="/platform/announcements"
            element={<Guard roles={['tenant_admin']} requireSuperuser><PlatformAnnouncementsPage /></Guard>}
          />

          <Route path="/notes" element={<Guard><NotesPage /></Guard>} />
          <Route path="/bookmarks" element={<Guard><BookmarksPage /></Guard>} />
          <Route path="/progress" element={<Guard><ProgressPage /></Guard>} />
          <Route path="/settings" element={<Guard><ProfilePage /></Guard>} />
          <Route path="/profile" element={<Navigate to="/settings" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

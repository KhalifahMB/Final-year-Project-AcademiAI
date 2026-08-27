import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';
import ChatPage from '@/pages/ChatPage';
import ResourcesPage from '@/pages/ResourcesPage';
import QuizzesPage from '@/pages/QuizzesPage';
import CoursesPage from '@/pages/CoursesPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import PasswordResetPage from '@/pages/PasswordResetPage';
import NotesPage from '@/pages/NotesPage';
import BookmarksPage from '@/pages/BookmarksPage';
import ProgressPage from '@/pages/ProgressPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminAuditPage from '@/pages/AdminAuditPage';
import AdminUsersPage from '@/pages/AdminUsersPage';
import TenantStructurePage from '@/pages/admin/TenantStructurePage';
import FacultyDetailPage from '@/pages/admin/FacultyDetailPage';
import DepartmentDetailPage from '@/pages/admin/DepartmentDetailPage';
import CourseManagePage from '@/pages/admin/CourseManagePage';
import AdminQuizzesPage from '@/pages/AdminQuizzesPage';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import PlatformConsolePage from '@/pages/PlatformConsolePage';
import PlatformTenantsPage from '@/pages/platform/TenantsPage';
import PlatformTenantDetailPage from '@/pages/platform/TenantDetailPage';
import PlatformAnalyticsPage from '@/pages/platform/AnalyticsPage';
import PlatformSystemHealthPage from '@/pages/platform/SystemHealthPage';
import PlatformAuditLogPage from '@/pages/platform/AuditLogPage';
import PlatformAnnouncementsPage from '@/pages/platform/AnnouncementsPage';
import PlatformRequestsPage from '@/pages/platform/RequestsPage';
import RequestInstitutionPage from '@/pages/RequestInstitutionPage';
import CourseDetailPage from '@/pages/CourseDetailPage';
import MyProgrammePage from '@/pages/MyProgrammePage';
import MyCoursesPage from '@/pages/MyCoursesPage';
import AssignedCoursesPage from '@/pages/AssignedCoursesPage';
import UploadResourcePage from '@/pages/UploadResourcePage';
import QuizTakePage from '@/pages/QuizTakePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

function ProtectedRoute({ children, roles, requireSuperuser, blockSuperuser }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (requireSuperuser && !user.is_superuser)
    return <Navigate to="/admin/dashboard" replace />;
  if (blockSuperuser && user.is_superuser)
    return <Navigate to="/platform" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/password-reset" element={<PasswordResetPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute blockSuperuser>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses"
            element={
              <ProtectedRoute>
                <CoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:id"
            element={
              <ProtectedRoute>
                <CourseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-courses"
            element={
              <ProtectedRoute>
                <MyCoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-programme"
            element={
              <ProtectedRoute>
                <MyProgrammePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assigned-courses"
            element={
              <ProtectedRoute roles={['lecturer', 'admin']}>
                <AssignedCoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources"
            element={
              <ProtectedRoute>
                <ResourcesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources/upload"
            element={
              <ProtectedRoute>
                <UploadResourcePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes"
            element={
              <ProtectedRoute>
                <QuizzesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes/:id/take"
            element={
              <ProtectedRoute>
                <QuizTakePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/quizzes"
            element={
              <ProtectedRoute roles={['lecturer', 'admin']}>
                <AdminQuizzesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute roles={['admin']} blockSuperuser>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform"
            element={
              <ProtectedRoute roles={['admin']} requireSuperuser>
                <PlatformConsolePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform/tenants"
            element={
              <ProtectedRoute roles={['admin']} requireSuperuser>
                <PlatformTenantsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform/tenants/:id"
            element={
              <ProtectedRoute roles={['admin']} requireSuperuser>
                <PlatformTenantDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform/requests"
            element={
              <ProtectedRoute roles={['admin']} requireSuperuser>
                <PlatformRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/request-institution" element={<RequestInstitutionPage />} />
          <Route
            path="/platform/analytics"
            element={
              <ProtectedRoute roles={['admin']} requireSuperuser>
                <PlatformAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform/health"
            element={
              <ProtectedRoute roles={['admin']} requireSuperuser>
                <PlatformSystemHealthPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform/audit"
            element={
              <ProtectedRoute roles={['admin']} requireSuperuser>
                <PlatformAuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform/announcements"
            element={
              <ProtectedRoute roles={['admin']} requireSuperuser>
                <PlatformAnnouncementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <NotesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookmarks"
            element={
              <ProtectedRoute>
                <BookmarksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <ProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={<Navigate to="/settings" replace />}
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute roles={['admin']} blockSuperuser>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute roles={['admin']} blockSuperuser>
                <AdminAuditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tenant"
            element={
              <ProtectedRoute roles={['admin']} blockSuperuser>
                <TenantStructurePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/faculties/:id"
            element={
              <ProtectedRoute roles={['admin']} blockSuperuser>
                <FacultyDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/departments/:id"
            element={
              <ProtectedRoute roles={['admin']} blockSuperuser>
                <DepartmentDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/courses/:id"
            element={
              <ProtectedRoute roles={['admin']} blockSuperuser>
                <CourseManagePage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

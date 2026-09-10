import { lazy } from 'react';

// Lazy-load every page so the initial bundle stays small. Centralized here
// so the route groups only reference names, never import paths.
export const LandingPage = lazy(() => import('@/pages/LandingPage'));
export const LoginPage = lazy(() => import('@/pages/LoginPage'));
export const SignupPage = lazy(() => import('@/pages/SignupPage'));
export const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
export const PasswordResetPage = lazy(() => import('@/pages/PasswordResetPage'));
export const RequestInstitutionPage = lazy(
  () => import('@/pages/RequestInstitutionPage'),
);

export const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
export const ChatPage = lazy(() => import('@/pages/ChatPage'));
export const ResourcesPage = lazy(() => import('@/pages/ResourcesPage'));
export const UploadResourcePage = lazy(() => import('@/pages/UploadResourcePage'));
export const QuizzesPage = lazy(() => import('@/pages/QuizzesPage'));
export const QuizTakePage = lazy(() => import('@/pages/QuizTakePage'));
export const CoursesPage = lazy(() => import('@/pages/CoursesPage'));
export const CourseDetailPage = lazy(() => import('@/pages/CourseDetailPage'));
export const MyCoursesPage = lazy(() => import('@/pages/MyCoursesPage'));
export const MyProgrammePage = lazy(() => import('@/pages/MyProgrammePage'));
export const AssignedCoursesPage = lazy(() => import('@/pages/AssignedCoursesPage'));
export const NotesPage = lazy(() => import('@/pages/NotesPage'));
export const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
export const BookmarksPage = lazy(() => import('@/pages/BookmarksPage'));
export const ProgressPage = lazy(() => import('@/pages/ProgressPage'));
export const PlansPage = lazy(() => import('@/pages/PlansPage'));
export const PlanDetailPage = lazy(() => import('@/pages/PlanDetailPage'));
export const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

export const AdminAuditPage = lazy(() => import('@/pages/AdminAuditPage'));
export const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
export const AdminQuizzesPage = lazy(() => import('@/pages/AdminQuizzesPage'));
export const AdminTemplatesPage = lazy(() => import('@/pages/AdminTemplatesPage'));
export const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
export const TenantLogsPage = lazy(() => import('@/pages/TenantLogsPage'));
export const TenantStructurePage = lazy(
  () => import('@/pages/admin/TenantStructurePage'),
);
export const FacultyDetailPage = lazy(() => import('@/pages/admin/FacultyDetailPage'));
export const DepartmentDetailPage = lazy(
  () => import('@/pages/admin/DepartmentDetailPage'),
);
export const CourseManagePage = lazy(() => import('@/pages/admin/CourseManagePage'));
export const AdminCoursesPage = lazy(() => import('@/pages/admin/AdminCoursesPage'));

export const PlatformConsolePage = lazy(() => import('@/pages/PlatformConsolePage'));
export const PlatformTenantsPage = lazy(() => import('@/pages/platform/TenantsPage'));
export const PlatformTenantDetailPage = lazy(
  () => import('@/pages/platform/TenantDetailPage'),
);
export const PlatformAnalyticsPage = lazy(() => import('@/pages/platform/AnalyticsPage'));
export const PlatformSystemHealthPage = lazy(
  () => import('@/pages/platform/SystemHealthPage'),
);
export const PlatformAuditLogPage = lazy(() => import('@/pages/platform/AuditLogPage'));
export const PlatformAnnouncementsPage = lazy(
  () => import('@/pages/platform/AnnouncementsPage'),
);
export const PlatformRequestsPage = lazy(() => import('@/pages/platform/RequestsPage'));
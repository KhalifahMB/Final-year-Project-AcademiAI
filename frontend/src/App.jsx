import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import DashboardPage from "@/pages/DashboardPage";
import ChatPage from "@/pages/ChatPage";
import ResourcesPage from "@/pages/ResourcesPage";
import QuizzesPage from "@/pages/QuizzesPage";
import CoursesPage from "@/pages/CoursesPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import PasswordResetPage from "@/pages/PasswordResetPage";
import NotesPage from "@/pages/NotesPage";
import BookmarksPage from "@/pages/BookmarksPage";
import ProgressPage from "@/pages/ProgressPage";
import ProfilePage from "@/pages/ProfilePage";
import AdminAuditPage from "@/pages/AdminAuditPage";
import AdminFacultiesPage from "@/pages/AdminFacultiesPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AdminDepartmentsPage from "@/pages/AdminDepartmentsPage";
import AdminProgrammesPage from "@/pages/AdminProgrammesPage";
import AdminCoursesPage from "@/pages/AdminCoursesPage";
import AdminOfferingsPage from "@/pages/AdminOfferingsPage";
import AdminEnrollmentsPage from "@/pages/AdminEnrollmentsPage";
import AdminTenantPage from "@/pages/AdminTenantPage";
import MyCoursesPage from "@/pages/MyCoursesPage";
import CourseDetailPage from "@/pages/CourseDetailPage";
import MyProgrammePage from "@/pages/MyProgrammePage";
import AssignedCoursesPage from "@/pages/AssignedCoursesPage";
import UploadResourcePage from "@/pages/UploadResourcePage";
import QuizTakePage from "@/pages/QuizTakePage";
import AdminSessionsPage from "@/pages/AdminSessionsPage";
import AdminSemestersPage from "@/pages/AdminSemestersPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } },
});

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
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
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
          <Route path="/courses/:id" element={<ProtectedRoute><CourseDetailPage /></ProtectedRoute>} />
          <Route path="/my-courses" element={<ProtectedRoute><MyCoursesPage /></ProtectedRoute>} />
          <Route path="/my-programme" element={<ProtectedRoute><MyProgrammePage /></ProtectedRoute>} />
          <Route path="/assigned-courses" element={<ProtectedRoute roles={["lecturer","admin"]}><AssignedCoursesPage /></ProtectedRoute>} />
          <Route path="/resources" element={<ProtectedRoute><ResourcesPage /></ProtectedRoute>} />
          <Route path="/resources/upload" element={<ProtectedRoute roles={["lecturer","admin"]}><UploadResourcePage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/quizzes" element={<ProtectedRoute><QuizzesPage /></ProtectedRoute>} />
          <Route path="/quizzes/:id/take" element={<ProtectedRoute><QuizTakePage /></ProtectedRoute>} />
          <Route path="/admin/sessions" element={<ProtectedRoute roles={["admin"]}><AdminSessionsPage /></ProtectedRoute>} />
          <Route path="/admin/semesters" element={<ProtectedRoute roles={["admin"]}><AdminSemestersPage /></ProtectedRoute>} />
          <Route path="/notes" element={<ProtectedRoute><NotesPage /></ProtectedRoute>} />
          <Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/faculties" element={<ProtectedRoute roles={["admin"]}><AdminFacultiesPage /></ProtectedRoute>} />
          <Route path="/admin/departments" element={<ProtectedRoute roles={["admin"]}><AdminDepartmentsPage /></ProtectedRoute>} />
          <Route path="/admin/programmes" element={<ProtectedRoute roles={["admin"]}><AdminProgrammesPage /></ProtectedRoute>} />
          <Route path="/admin/courses" element={<ProtectedRoute roles={["admin"]}><AdminCoursesPage /></ProtectedRoute>} />
          <Route path="/admin/offerings" element={<ProtectedRoute roles={["admin"]}><AdminOfferingsPage /></ProtectedRoute>} />
          <Route path="/admin/enrollments" element={<ProtectedRoute roles={["admin"]}><AdminEnrollmentsPage /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute roles={["admin"]}><AdminAuditPage /></ProtectedRoute>} />
          <Route path="/admin/tenant" element={<ProtectedRoute roles={["admin"]}><AdminTenantPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

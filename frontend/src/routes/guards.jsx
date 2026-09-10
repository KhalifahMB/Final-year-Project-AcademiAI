import { Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { RouteLoading } from '@/components/common/NotFoundPage';
import { roleHome } from '@/lib/access';

export function ProtectedRoute({ children, roles, requireSuperuser }) {
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

export function SuspenseShell({ children }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

// Tiny helper to DRY up <SuspenseShell><ProtectedRoute>...</ProtectedRoute></SuspenseShell>
export function Guard({ children, ...guardProps }) {
  return (
    <SuspenseShell>
      <ProtectedRoute {...guardProps}>{children}</ProtectedRoute>
    </SuspenseShell>
  );
}
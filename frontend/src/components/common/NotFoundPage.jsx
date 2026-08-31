import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BrandMark from '@/components/shared/BrandMark';
import { Home } from 'lucide-react';

/**
 * Full-screen branded loading state for route-level Suspense.
 */
export function RouteLoading({ label = 'Loading…' } = {}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <BrandMark size="h-8 w-8" className="animate-pulse-soft text-primary" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * Shown inside the AppShell for authenticated 404s.
 */
export function InAppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[56px] font-semibold leading-none tracking-tighter text-primary/20">
        404
      </p>
      <h2 className="mt-2 text-lg font-semibold">Page not found</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <div className="mt-5 flex gap-2">
        <Button asChild size="sm">
          <Link to="/dashboard">
            <Home className="mr-2 h-3.5 w-3.5" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Public (marketing/auth) 404.
 */
export function NotFoundPage() {
  const location = useLocation();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn('404:', location.pathname);
  }, [location.pathname]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <BrandMark size="h-10 w-10" className="text-primary" />
      <p className="mt-6 text-[64px] font-semibold leading-none tracking-tighter text-primary/25">
        404
      </p>
      <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The page <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{location.pathname}</code> doesn't exist.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}

export default NotFoundPage;

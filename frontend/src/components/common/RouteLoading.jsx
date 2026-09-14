import BrandMark from '@/components/shared/BrandMark';

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

export default RouteLoading;
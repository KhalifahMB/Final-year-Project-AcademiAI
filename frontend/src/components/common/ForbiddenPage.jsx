import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandMark from '@/components/shared/BrandMark';
import { useAuth } from '@/hooks/useAuth';
import { roleHome } from '@/lib/access';

/**
 * Explicit 403 screen for authenticated users whose role can't open a page.
 * Shown instead of a silent redirect so the rejection is legible, with a
 * role-appropriate "back to work" destination.
 */
export function ForbiddenPage() {
  const { user } = useAuth();
  const home = roleHome(user);
  const label = user?.is_superuser ? 'Go to platform console' : 'Go to my workspace';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <BrandMark size="h-10 w-10" className="text-primary" />
      <p className="mt-6 text-[64px] font-semibold leading-none tracking-tighter text-primary/25">
        403
      </p>
      <h1 className="mt-2 text-xl font-semibold">Access denied</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Your role doesn't have permission to open this page.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link to={home}>
            <ShieldAlert className="mr-2 h-4 w-4" aria-hidden />
            {label}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default ForbiddenPage;
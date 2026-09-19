# Layout Components (AcademiAI frontend)

## Landing nav (public)
- File: `frontend/src/pages/LandingPage.jsx` (inline in the page component, section starts ~line 405)
- Renders a sticky 64px glass shell: `BrandMark` + "AcademiAI" wordmark, centered nav links (Product / Security / Roles / How it works), `ThemeToggle` (icon-only), and auth-aware CTAs (Sign in + Request workspace; or "Open workspace" when authenticated).
- Styling: `.landing-nav`, `.landing-nav__inner`, `.landing-nav__links`, `.landing-nav__actions`, `.landing-brand` in `styles/landing.css`.

## Landing footer
- File: `frontend/src/pages/LandingPage.jsx` (section ~line 842)
- `BrandMark` + wordmark, footer links (Security / Institutions / FAQ / Sign in), copyright line. Styling: `.landing-footer`, `.landing-footer__inner`, `.landing-footer__links`.

## App shell (authenticated app)
- File: `frontend/src/components/layout/AppShell.jsx` (~929 lines)
- Renders the authenticated workspace shell: desktop sidebar (collapsible 248px → 60px, role-keyed nav sections), mobile drawer, topbar (56px glass) with search, theme toggle, user menu, `CommandPalette`, `FloatingAgent`, `NotificationToaster`. Nav data is role-keyed (`SUPERUSER_NAV`, `ADMIN_NAV`, `LECTURER_NAV`, `STUDENT_NAV`) and `ROLE_LABELS`.
- This shell is NOT used by the landing page — it wraps protected routes only.

```jsx
// Abridged AppShell (full file is 929 lines). Key structure:
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ThemeToggle from '@/components/shared/ThemeToggle';
import BrandMark from '@/components/shared/BrandMark';
import Avatar from '@/components/shared/Avatar';
import OnlineStatus from '@/components/shared/OnlineStatus';
import CommandPalette from '@/components/common/CommandPalette';
import FloatingAgent from '@/components/agent/FloatingAgent';
import NotificationToaster from '@/components/notifications/NotificationToaster';

const ROLE_LABELS = { student: 'Student', lecturer: 'Lecturer', tenant_admin: 'Tenant Admin' };
// SUPERUSER_NAV / ADMIN_NAV / LECTURER_NAV / STUDENT_NAV arrays
// drive the sidebar sections. Items: { to, label, icon, badge? }.

export default function AppShell({ children }) {
  // topbar: left BrandMark + hamburger (mobile), search, online status,
  // theme toggle, user dropdown; body: sidebar + <main>{children}</main>
}
```

## Route shell (public + guarded)
- File: `frontend/src/routes/guards.jsx`
- `SuspenseShell` wraps every page in `<ErrorBoundary><Suspense fallback={<RouteLoading/>}>`; `Guard` composes it with `ProtectedRoute` (auth / tenant / role / superuser checks).

```jsx
import { Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { RouteLoading } from '@/components/common/RouteLoading';
import { roleHome } from '@/lib/access';

export function ProtectedRoute({ children, roles, requireSuperuser }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoading label="Loading your workspace…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (requireSuperuser) {
    if (user.is_superuser) return children;
    return <Navigate to={roleHome(user)} replace />;
  }
  if (user.is_superuser) return <Navigate to="/platform" replace />;
  if (!user.tenant) return <Navigate to="/request-institution" replace />;
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

export function Guard({ children, ...guardProps }) {
  return (
    <SuspenseShell>
      <ProtectedRoute {...guardProps}>{children}</ProtectedRoute>
    </SuspenseShell>
  );
}
```

## ThemeProvider / theme hook
- File: `frontend/src/hooks/useTheme.js` (there is no context provider; the hook manages `document.documentElement` class + localStorage `academiai-theme` + broadcasts a `academiai-theme-change` window event).

```jsx
import { useEffect, useState } from 'react';

const KEY = 'academiai-theme';

function notifyThemeChange(dark) {
  window.dispatchEvent(
    new CustomEvent('academiai-theme-change', { detail: { dark } }),
  );
}

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(KEY) === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch {}
    notifyThemeChange(dark);
  }, [dark]);

  useEffect(() => {
    const handleThemeChange = (event) => setDark(Boolean(event.detail?.dark));
    window.addEventListener('academiai-theme-change', handleThemeChange);
    return () => window.removeEventListener('academiai-theme-change', handleThemeChange);
  }, []);

  return { dark, toggle: () => setDark((d) => !d) };
}
```
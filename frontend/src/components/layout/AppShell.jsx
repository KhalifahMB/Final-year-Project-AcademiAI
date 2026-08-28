import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ThemeToggle from '@/components/shared/ThemeToggle';
import BrandMark from '@/components/shared/BrandMark';
import Avatar from '@/components/shared/Avatar';
import OnlineStatus from '@/components/shared/OnlineStatus';
import CommandPalette from '@/components/common/CommandPalette';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { cn } from '@/lib/utils';
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  FileText,
  GraduationCap,
  Home,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareText,
  Bookmark,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Settings,
  StickyNote,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  X,
} from 'lucide-react';

/* =============================================================
   Navigation (role-keyed). Each item: { to, label, icon, badge? }.
   Sections drive grouping in the expanded sidebar and tooltip
   titles in collapsed mode.
   ============================================================= */

const SUPERUSER_NAV = [
  {
    section: 'Platform',
    items: [
      { to: '/platform', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/platform/tenants', label: 'Tenants', icon: Building2 },
      { to: '/platform/requests', label: 'Requests', icon: Inbox, badge: 'new' },
      { to: '/platform/announcements', label: 'Announcements', icon: Megaphone },
    ],
  },
  {
    section: 'Operations',
    items: [
      { to: '/platform/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/platform/health', label: 'System Health', icon: Activity },
      { to: '/platform/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
];

const ADMIN_NAV = [
  {
    section: 'Learn',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/assigned-courses', label: 'Assigned', icon: GraduationCap },
      { to: '/courses', label: 'Courses', icon: BookOpen },
    ],
  },
  {
    section: 'Workspace',
    items: [
      { to: '/resources', label: 'Resources', icon: FileText },
      { to: '/resources/upload', label: 'Upload', icon: Upload },
      { to: '/chat', label: 'AI Assistant', icon: MessageSquareText },
      { to: '/quizzes', label: 'Quizzes', icon: ClipboardList },
      { to: '/admin/quizzes', label: 'Quiz Manager', icon: ClipboardPlus },
    ],
  },
  {
    section: 'Personal',
    items: [
      { to: '/notes', label: 'Notes', icon: StickyNote },
      { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
      { to: '/progress', label: 'Progress', icon: TrendingUp },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/admin/dashboard', label: 'Admin', icon: LayoutDashboard },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/tenant', label: 'Institution', icon: Building2 },
      { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
    ],
  },
];

const LECTURER_NAV = [
  {
    section: 'Learn',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/assigned-courses', label: 'Assigned', icon: GraduationCap },
      { to: '/courses', label: 'Courses', icon: BookOpen },
    ],
  },
  {
    section: 'Workspace',
    items: [
      { to: '/resources', label: 'Resources', icon: FileText },
      { to: '/resources/upload', label: 'Upload', icon: Upload },
      { to: '/chat', label: 'AI Assistant', icon: MessageSquareText },
      { to: '/quizzes', label: 'Quizzes', icon: ClipboardList },
      { to: '/admin/quizzes', label: 'Quiz Manager', icon: ClipboardPlus },
    ],
  },
  {
    section: 'Personal',
    items: [
      { to: '/notes', label: 'Notes', icon: StickyNote },
      { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
      { to: '/progress', label: 'Progress', icon: TrendingUp },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const STUDENT_NAV = [
  {
    section: 'Learn',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/my-programme', label: 'Programme', icon: Building2 },
      { to: '/my-courses', label: 'My Courses', icon: GraduationCap },
      { to: '/courses', label: 'Catalogue', icon: BookOpen },
    ],
  },
  {
    section: 'Workspace',
    items: [
      { to: '/resources', label: 'Resources', icon: FileText },
      { to: '/chat', label: 'AI Assistant', icon: MessageSquareText },
      { to: '/quizzes', label: 'Quizzes', icon: ClipboardList },
    ],
  },
  {
    section: 'Personal',
    items: [
      { to: '/notes', label: 'Notes', icon: StickyNote },
      { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
      { to: '/progress', label: 'Progress', icon: TrendingUp },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function getNav(user) {
  if (!user) return [];
  if (user.is_superuser) return SUPERUSER_NAV;
  if (user.role === 'admin') return ADMIN_NAV;
  if (user.role === 'lecturer') return LECTURER_NAV;
  return STUDENT_NAV;
}

/* Flatten a nav structure to a single list of items for lookup. */
function flattenNav(sections) {
  return sections.flatMap((s) => s.items || []);
}

/* ============================================================= */

function NavItem({ item, collapsed, active, onNavigate }) {
  const Icon = item.icon;
  const node = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
        collapsed ? 'h-9 w-9 justify-center' : 'h-8 px-2.5',
        active
          ? 'bg-sidebar-active text-primary dark:text-sidebar-accent'
          : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground',
      )}
    >
      {/* Active indicator strip */}
      {active && (
        <span
          className={cn(
            'absolute rounded-full bg-primary dark:bg-sidebar-accent',
            collapsed
              ? 'left-0 top-1/2 h-5 w-[3px] -translate-y-1/2'
              : '-left-0 top-1/2 h-5 w-[3px] -translate-y-1/2',
          )}
          aria-hidden
        />
      )}
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
  if (collapsed) {
    return (
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2 text-xs">
          {item.label}
          {item.badge && <span className="rounded bg-primary/20 px-1 text-[10px]">{item.badge}</span>}
        </TooltipContent>
      </Tooltip>
    );
  }
  return node;
}

function UserMenu({ user, logout }) {
  const displayName =
    user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email;
  const roleLabel = user?.is_superuser
    ? 'Platform Operator'
    : (user?.role || '').charAt(0).toUpperCase() + (user?.role || '').slice(1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="group flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-hover"
        >
          <Avatar user={user} className="h-7 w-7 shrink-0 rounded-full ring-1 ring-sidebar-border" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold leading-tight text-sidebar-foreground">
              {displayName}
            </p>
            <p className="truncate text-[10px] capitalize text-sidebar-muted">{roleLabel}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 -rotate-90 text-sidebar-muted transition-transform group-data-[state=open]:rotate-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56" sideOffset={8}>
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm">{displayName}</span>
          <span className="truncate text-[11px] font-normal text-muted-foreground">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <UserRound className="mr-2 h-3.5 w-3.5" /> Profile & settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard">
            <Home className="mr-2 h-3.5 w-3.5" /> Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600 dark:text-red-400">
          <LogOut className="mr-2 h-3.5 w-3.5" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarDesktop({ sections, collapsed, onToggleCollapse, onNavigate, activeKey, user }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex',
        collapsed ? 'w-[60px]' : 'w-[232px]',
      )}
      aria-label="Main navigation"
    >
      {/* Top: Brand + collapse */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'px-3',
        )}
      >
        <Link
          to={user?.is_superuser ? '/platform' : '/dashboard'}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2 rounded-md transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring',
            collapsed ? 'justify-center' : '',
          )}
          title={collapsed ? 'AcademiAI' : undefined}
        >
          <BrandMark size="h-8 w-8" />
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
              AcademiAI
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Ctrl+B)"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Nav (scrollable) */}
      <nav
        className={cn(
          'flex-1 space-y-5 overflow-y-auto py-3',
          collapsed ? 'px-2' : 'px-2.5',
        )}
      >
        {sections.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/80">
                {section.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavItem
                    item={item}
                    collapsed={collapsed}
                    active={activeKey === item.to}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: Theme + User */}
      <div
        className={cn(
          'shrink-0 border-t border-sidebar-border',
          collapsed ? 'p-2' : 'p-2',
        )}
      >
        {!collapsed ? (
          <div className="space-y-1">
            <UserMenu user={user} />
            <ThemeToggle className="w-full" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    aria-label="Expand sidebar"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                  >
                    <PanelLeftOpen className="h-4 w-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar (Ctrl+B)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ThemeToggle className="h-9 w-9 justify-center rounded-md" iconOnly />
                </TooltipTrigger>
                <TooltipContent side="right">Toggle theme</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/settings"
                    className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-sidebar-hover"
                  >
                    <Avatar user={user} className="h-7 w-7 rounded-full ring-1 ring-sidebar-border" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {user?.first_name || user?.email}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </aside>
  );
}

function MobileDrawer({ open, onClose, sections, onNavigate, activeKey, user, logout }) {
  return (
    open && (
      <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-sidebar shadow-2xl">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
            <Link to={user?.is_superuser ? '/platform' : '/dashboard'} onClick={onNavigate} className="flex items-center gap-2">
              <BrandMark size="h-8 w-8" />
              <span className="text-[15px] font-semibold text-sidebar-foreground">AcademiAI</span>
            </Link>
            <button
              type="button"
              aria-label="Close menu"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
            {sections.map((section) => (
              <div key={section.section}>
                <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/80">
                  {section.section}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavItem item={item} collapsed={false} active={activeKey === item.to} onNavigate={onNavigate} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="shrink-0 space-y-1 border-t border-sidebar-border p-2">
            <UserMenu user={user} logout={logout} />
            <ThemeToggle className="w-full" />
          </div>
        </aside>
      </div>
    )
  );
}

/* ============================================================= */

export default function AppShell({ title, description, actions, children, fullBleed = false }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const isMobile = useIsMobile();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('academiai:sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem('academiai:sidebar-collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Ctrl/Cmd+B toggles the sidebar.
  useKeyboardShortcut('mod+b', () => setCollapsed((c) => !c));
  // ⌘K opens the command palette.
  useKeyboardShortcut('mod+k', (e) => {
    e.preventDefault();
    setPaletteOpen((o) => !o);
  });

  // External events can open the palette.
  useEffect(() => {
    const handler = () => setPaletteOpen(true);
    window.addEventListener('academiai:open-command-palette', handler);
    return () => window.removeEventListener('academiai:open-command-palette', handler);
  }, []);

  // External components (e.g. fullscreen resource preview) can request
  // sidebar state via CustomEvent('academiai:request-sidebar', {detail:{collapsed}}).
  useEffect(() => {
    const onRequest = (e) => {
      const want = e.detail?.collapsed;
      if (typeof want === 'boolean') setCollapsed(want);
    };
    window.addEventListener('academiai:request-sidebar', onRequest);
    return () => window.removeEventListener('academiai:request-sidebar', onRequest);
  }, []);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  const sections = useMemo(() => getNav(user), [user]);
  const flat = useMemo(() => flattenNav(sections), [sections]);
  const activeKey = useMemo(() => {
    // Exact match first, then prefix match for nested pages (e.g. /resources/:id).
    const exact = flat.find((i) => i.to === loc.pathname);
    if (exact) return exact.to;
    // Avoid false positives on /dashboard vs /d/...: require path to be a
    // directory boundary.
    const prefix = flat
      .filter((i) => i.to !== '/dashboard' && i.to !== '/admin/dashboard' && i.to !== '/platform')
      .find((i) => loc.pathname.startsWith(i.to + '/') || loc.pathname === i.to);
    return prefix?.to || (user?.is_superuser ? '/platform' : '/dashboard');
  }, [flat, loc.pathname, user]);

  const openPalette = () => setPaletteOpen(true);

  const contentPadding = collapsed ? 'lg:pl-[60px]' : 'lg:pl-[232px]';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background text-foreground">
        {/* Desktop sidebar */}
        <SidebarDesktop
          sections={sections}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onNavigate={() => setMobileOpen(false)}
          activeKey={activeKey}
          user={user}
        />

        {/* Mobile drawer */}
        <MobileDrawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sections={sections}
          onNavigate={() => setMobileOpen(false)}
          activeKey={activeKey}
          user={user}
          logout={logout}
        />

        {/* Main column */}
        <div className={cn('flex min-h-screen flex-col', contentPadding)}>
          {!fullBleed && (
            <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5 glass">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open menu"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-[18px] w-[18px]" aria-hidden />
              </Button>
              {collapsed && !isMobile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="hidden lg:inline-flex"
                  aria-label="Expand sidebar"
                  title="Expand sidebar (Ctrl+B)"
                  onClick={() => setCollapsed(false)}
                >
                  <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
                </Button>
              )}

              {/* Breadcrumb / page title */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground/90">
                  {title}
                </p>
              </div>

              {/* Command-palette trigger */}
              <button
                type="button"
                onClick={openPalette}
                className="hidden items-center gap-2 rounded-md border bg-card px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted md:inline-flex"
              >
                <Search className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden lg:inline">Search…</span>
                <kbd className="ml-1 hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono lg:inline">
                  ⌘K
                </kbd>
              </button>

              <div className="ml-auto flex items-center gap-1.5">
                <OnlineStatus className="hidden sm:inline-flex" />
                <ThemeToggle className="lg:hidden" iconOnly />
              </div>
            </header>
          )}

          {fullBleed ? (
            <main className="flex h-screen w-full flex-col overflow-hidden">{children}</main>
          ) : (
            <main
              className={cn(
                'mx-auto w-full flex-1',
                'px-3 py-4 sm:px-5 sm:py-5',
                'max-w-[1400px]',
              )}
            >
              <div className="view-enter">
                {(title || description || actions) && (
                  <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      {title && (
                        <h1 className="text-[1.35rem] font-semibold tracking-tight sm:text-xl">
                          {title}
                        </h1>
                      )}
                      {description && (
                        <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
                          {description}
                        </p>
                      )}
                    </div>
                    {actions && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {actions}
                      </div>
                    )}
                  </header>
                )}
                {children}
              </div>
            </main>
          )}
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpen={setPaletteOpen} />
    </TooltipProvider>
  );
}

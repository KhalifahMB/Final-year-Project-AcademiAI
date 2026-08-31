import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

const ROLE_LABELS = {
  student: 'Student',
  lecturer: 'Lecturer',
  tenant_admin: 'Tenant Admin',
};

function roleLabel(user) {
  if (user?.is_superuser) return 'Platform Operator';
  const role = user?.role || '';
  return ROLE_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1);
}

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
    section: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/resources', label: 'Resources', icon: FileText },
      { to: '/chat', label: 'AI Chat', icon: MessageSquareText },
    ],
  },
  {
    section: 'Teaching',
    items: [
      { to: '/courses', label: 'Courses', icon: BookOpen },
      { to: '/assigned-courses', label: 'My Courses', icon: GraduationCap },
      { to: '/quizzes', label: 'Quizzes', icon: ClipboardList },
      { to: '/admin/quizzes', label: 'Quiz Manager', icon: ClipboardPlus },
      { to: '/resources/upload', label: 'Upload', icon: Upload },
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
      { to: '/admin/dashboard', label: 'Institution dashboard', icon: LayoutDashboard },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/tenant', label: 'Structure', icon: Building2 },
      { to: '/admin/courses', label: 'Manage Courses', icon: BookOpen },
      { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
    ],
  },
];

const LECTURER_NAV = [
  {
    section: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/resources', label: 'Resources', icon: FileText },
      { to: '/chat', label: 'AI Chat', icon: MessageSquareText },
    ],
  },
  {
    section: 'Teaching',
    items: [
      { to: '/courses', label: 'Courses', icon: BookOpen },
      { to: '/assigned-courses', label: 'My Courses', icon: GraduationCap },
      { to: '/quizzes', label: 'Quizzes', icon: ClipboardList },
      { to: '/admin/quizzes', label: 'Quiz Manager', icon: ClipboardPlus },
      { to: '/resources/upload', label: 'Upload', icon: Upload },
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
    section: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/resources', label: 'Resources', icon: FileText },
      { to: '/chat', label: 'AI Chat', icon: MessageSquareText },
    ],
  },
  {
    section: 'Learning',
    items: [
      { to: '/my-courses', label: 'My Courses', icon: GraduationCap },
      { to: '/courses', label: 'Catalogue', icon: BookOpen },
      { to: '/quizzes', label: 'Quizzes', icon: ClipboardList },
      { to: '/my-programme', label: 'Programme', icon: Building2 },
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
  if (user.role === 'tenant_admin') return ADMIN_NAV;
  if (user.role === 'lecturer') return LECTURER_NAV;
  return STUDENT_NAV;
}

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
        'group relative flex items-center gap-2.5 rounded-[var(--radius-md)] text-[13.5px] font-[520] transition-colors duration-150',
        'min-h-[38px]',
        collapsed
          ? 'h-[38px] w-[38px] justify-center mx-auto'
          : 'px-2.5 py-0 mx-1',
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] font-[600]'
          : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0 text-[10px] font-[590] uppercase tracking-wide text-[var(--muted)] border border-[var(--border)]">
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
          {item.badge && <span className="rounded bg-[var(--accent-soft)] px-1 text-[10px] text-[var(--accent-strong)]">{item.badge}</span>}
        </TooltipContent>
      </Tooltip>
    );
  }
  return node;
}

function UserMenu({ user }) {
  const displayName =
    user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="group flex w-full items-center gap-2.5 rounded-[var(--radius-md)] p-1.5 text-left transition-colors hover:bg-[var(--hover)]"
        >
          <Avatar user={user} className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-[600] leading-tight text-[var(--fg)]">
              {displayName}
            </p>
            <p className="truncate text-[11px] capitalize text-[var(--muted)]">{roleLabel(user)}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 -rotate-90 text-[var(--muted)] transition-transform group-data-[state=open]:rotate-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-64 rounded-[var(--radius-lg)] p-1 shadow-[var(--shadow-pop)]" sideOffset={8}>
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="truncate text-sm font-[600]">{displayName}</span>
          <span className="truncate text-[11px] font-normal text-[var(--muted)]">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-[var(--radius-sm)] h-9">
          <Link to="/settings">
            <UserRound className="mr-2 h-3.5 w-3.5" /> Profile & settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-[var(--radius-sm)] h-9">
          <Link to="/dashboard">
            <Home className="mr-2 h-3.5 w-3.5" /> Dashboard
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TenantCard({ user, collapsed }) {
  if (collapsed) {
    return (
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)]">
            <Building2 className="h-4 w-4" aria-hidden />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {user?.tenant?.name || 'Institution'}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] p-1.5 hover:bg-[var(--hover)] transition-colors">
      <span className="inline-grid h-8 w-8 place-items-center rounded-[var(--radius-md)] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)]">
        <Building2 className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-[600] leading-tight text-[var(--fg)]">
          {user?.tenant?.name || 'Institution'}
        </p>
        <p className="truncate text-[11px] text-[var(--muted)]">
          {user?.first_name || user?.email} · {roleLabel(user)}
        </p>
      </div>
    </div>
  );
}

function SidebarDesktop({ sections, collapsed, onToggleCollapse, onNavigate, activeKey, user }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 ease-out lg:flex',
        collapsed ? 'w-[60px]' : 'w-[var(--sidebar-w)]',
      )}
      style={{ ['--sidebar-w']: '248px' }}
      aria-label="Main navigation"
    >
      {/* Top: Brand + collapse */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)]',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <Link
          to={user?.is_superuser ? '/platform' : '/dashboard'}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 rounded-md transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--ring)]',
            collapsed ? 'justify-center' : '',
          )}
          title={collapsed ? 'AcademiAI' : undefined}
        >
          <BrandMark size="h-7 w-7" />
          {!collapsed && (
            <span className="text-[16px] font-[680] tracking-[-0.02em] text-[var(--fg)]">
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
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)]"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Nav (scrollable) */}
      <nav
        className={cn(
          'flex-1 overflow-y-auto py-3',
          collapsed ? 'px-2' : 'px-2',
        )}
      >
        {sections.map((section) => (
          <div key={section.section} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-3.5 text-[11px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
                {section.section}
              </p>
            )}
            <ul className={cn('space-y-0.5', collapsed && 'flex flex-col items-center')}>
              {section.items.map((item) => (
                <li key={item.to} className={cn(collapsed ? 'w-full flex justify-center' : 'w-full')}>
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

      {/* Bottom: tenant + user + theme */}
      <div
        className={cn(
          'shrink-0 border-t border-[var(--border)] p-2',
        )}
      >
        {!collapsed ? (
          <div className="space-y-1">
            <TenantCard user={user} />
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
                    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-md)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
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
                  <ThemeToggle className="h-[38px] w-[38px] justify-center rounded-[var(--radius-md)]" iconOnly />
                </TooltipTrigger>
                <TooltipContent side="right">Toggle theme</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/settings"
                    className="mt-1 inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--hover)]"
                  >
                    <Avatar user={user} className="h-8 w-8 rounded-full" />
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

function MobileDrawer({ open, onClose, sections, onNavigate, activeKey, user }) {
  return (
    open && (
      <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[var(--surface)] shadow-[var(--shadow-pop)]">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
            <Link to={user?.is_superuser ? '/platform' : '/dashboard'} onClick={onNavigate} className="flex items-center gap-2.5">
              <BrandMark size="h-7 w-7" />
              <span className="text-[16px] font-[680] tracking-[-0.02em] text-[var(--fg)]">AcademiAI</span>
            </Link>
            <button
              type="button"
              aria-label="Close menu"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
            {sections.map((section) => (
              <div key={section.section}>
                <p className="mb-1.5 px-3 text-[11px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
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
          <div className="shrink-0 space-y-1 border-t border-[var(--border)] p-2">
            <TenantCard user={user} />
            <UserMenu user={user} />
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
  const navigate = useNavigate();
  const searchRef = useRef(null);

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

  // External components can request sidebar state via CustomEvent.
  useEffect(() => {
    const onRequest = (e) => {
      const want = e.detail?.collapsed;
      if (typeof want === 'boolean') setCollapsed(want);
    };
    window.addEventListener('academiai:request-sidebar', onRequest);
    return () => window.removeEventListener('academiai:request-sidebar', onRequest);
  }, []);

  // Close mobile drawer on route change (adjust state during render so the
  // drawer never lingers open after navigating between pages).
  const [prevPath, setPrevPath] = useState(loc.pathname);
  if (loc.pathname !== prevPath) {
    setPrevPath(loc.pathname);
    setMobileOpen(false);
  }

  const sections = useMemo(() => getNav(user), [user]);
  const flat = useMemo(() => flattenNav(sections), [sections]);
  const activeKey = useMemo(() => {
    const exact = flat.find((i) => i.to === loc.pathname);
    if (exact) return exact.to;
    const prefix = flat
      .filter((i) => i.to !== '/dashboard' && i.to !== '/admin/dashboard' && i.to !== '/platform')
      .find((i) => loc.pathname.startsWith(i.to + '/') || loc.pathname === i.to);
    return prefix?.to || (user?.is_superuser ? '/platform' : '/dashboard');
  }, [flat, loc.pathname, user]);

  const contentPadding = collapsed ? 'lg:pl-[60px]' : 'lg:pl-[248px]';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
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
        />

        {/* Main column */}
        <div className={cn('flex min-h-screen flex-col', contentPadding)}>
          {!fullBleed && (
            <header
              className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--border)] px-4 sm:px-7"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-4 w-4" aria-hidden />
              </Button>
              {collapsed && !isMobile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  aria-label="Expand sidebar"
                  title="Expand sidebar (Ctrl+B)"
                  onClick={() => setCollapsed(false)}
                >
                  <PanelLeftOpen className="h-4 w-4" aria-hidden />
                </Button>
              )}

              {/* Search field (navigates to the resources library) */}
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = searchRef.current?.value.trim() || '';
                  navigate(q ? `/resources?q=${encodeURIComponent(q)}` : '/resources');
                }}
                className="flex h-9 w-full min-w-0 max-w-[440px] flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 transition-colors focus-within:border-[var(--border)] md:max-w-[min(340px,42vw)]"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  defaultValue=""
                  placeholder="Search resources, quizzes…"
                  aria-label="Search materials"
                  className="h-full w-full min-w-0 bg-transparent text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--muted)]"
                />
              </form>

              {/* Title is now inside the content area (page header) */}
              <div className="ml-auto flex items-center gap-1.5">
                <OnlineStatus className="hidden sm:inline-flex" />
                <ThemeToggle className="lg:hidden" iconOnly />
                <UserMenuSmall user={user} logout={logout} />
              </div>
            </header>
          )}

          {fullBleed ? (
            <main className="flex h-screen w-full flex-col overflow-hidden">{children}</main>
          ) : (
            <main
              className={cn(
                'mx-auto w-full flex-1',
                'px-4 py-5 sm:px-7 sm:py-6',
                'max-w-[1280px]',
              )}
            >
              <div className="view-enter">
                {(title || description || actions) && (
                  <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      {title && (
                        <h1 className="text-[30px] font-[650] leading-[1.15] tracking-[-0.02em]">
                          {title}
                        </h1>
                      )}
                      {description && (
                        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--muted)]">
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

/* Avatar-only trigger for the topbar with a compact account menu */
function UserMenuSmall({ user, logout }) {
  const displayName =
    user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--hover)]"
        >
          <Avatar user={user} className="h-[30px] w-[30px] rounded-full" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-[var(--radius-lg)] p-1 shadow-[var(--shadow-pop)]" sideOffset={8}>
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="truncate text-sm font-[600]">{displayName}</span>
          <span className="truncate text-[11px] font-normal text-[var(--muted)]">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-[var(--radius-sm)] h-9">
          <Link to="/settings">
            <UserRound className="mr-2 h-3.5 w-3.5" /> Profile & settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="rounded-[var(--radius-sm)] h-9 text-[var(--danger)] focus:text-[var(--danger)]">
          <LogOut className="mr-2 h-3.5 w-3.5" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

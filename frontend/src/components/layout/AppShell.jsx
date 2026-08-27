import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/shared/ThemeToggle";
import BrandMark from "@/components/shared/BrandMark";
import Avatar from "@/components/shared/Avatar";
import OnlineStatus from "@/components/shared/OnlineStatus";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  FileText,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareText,
  Bookmark,
  ScrollText,
  StickyNote,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";

/**
 * Navigation sections keyed by role.
 *
 * Each section: { label, items }
 * Each item:    { to, label, icon, badge? }
 */

const SUPERUSER_SECTIONS = [
  {
    label: "Overview",
    items: [
      { to: "/platform", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Management",
    items: [
      { to: "/platform/tenants", label: "Tenants", icon: Building2 },
      { to: "/platform/requests", label: "Sign-up Requests", icon: Inbox, badge: "new" },
      { to: "/platform/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/platform/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/platform/health", label: "System Health", icon: Activity },
      { to: "/platform/audit", label: "Audit Log", icon: ScrollText },
    ],
  },
];

const ADMIN_SECTIONS = [
  {
    label: "Learn",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/assigned-courses", label: "Assigned Courses", icon: GraduationCap },
      { to: "/courses", label: "Catalogue", icon: BookOpen },
    ],
  },
  {
    label: "Resources & AI",
    items: [
      { to: "/resources", label: "Resources", icon: FileText },
      { to: "/resources/upload", label: "Upload Material", icon: Upload },
      { to: "/chat", label: "AI Assistant", icon: MessageSquareText },
      { to: "/quizzes", label: "Quizzes", icon: ClipboardList },
      { to: "/admin/quizzes", label: "Quiz Manager", icon: ClipboardPlus },
    ],
  },
  {
    label: "Personal",
    items: [
      { to: "/notes", label: "Notes", icon: StickyNote },
      { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { to: "/progress", label: "Progress", icon: TrendingUp },
      { to: "/settings", label: "Settings", icon: UserRound },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/admin/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/tenant", label: "Institution", icon: Building2 },
      { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
    ],
  },
];

const LECTURER_SECTIONS = [
  {
    label: "Learn",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/assigned-courses", label: "Assigned Courses", icon: GraduationCap },
      { to: "/courses", label: "Catalogue", icon: BookOpen },
    ],
  },
  {
    label: "Resources & AI",
    items: [
      { to: "/resources", label: "Resources", icon: FileText },
      { to: "/resources/upload", label: "Upload Material", icon: Upload },
      { to: "/chat", label: "AI Assistant", icon: MessageSquareText },
      { to: "/quizzes", label: "Quizzes", icon: ClipboardList },
      { to: "/admin/quizzes", label: "Quiz Manager", icon: ClipboardPlus },
    ],
  },
  {
    label: "Personal",
    items: [
      { to: "/notes", label: "Notes", icon: StickyNote },
      { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { to: "/progress", label: "Progress", icon: TrendingUp },
      { to: "/settings", label: "Settings", icon: UserRound },
    ],
  },
];

const STUDENT_SECTIONS = [
  {
    label: "Learn",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/my-programme", label: "My Programme", icon: Building2 },
      { to: "/my-courses", label: "My Courses", icon: GraduationCap },
      { to: "/courses", label: "Catalogue", icon: BookOpen },
    ],
  },
  {
    label: "Resources & AI",
    items: [
      { to: "/resources", label: "Resources", icon: FileText },
      { to: "/chat", label: "AI Assistant", icon: MessageSquareText },
      { to: "/quizzes", label: "Quizzes", icon: ClipboardList },
    ],
  },
  {
    label: "Personal",
    items: [
      { to: "/notes", label: "Notes", icon: StickyNote },
      { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { to: "/progress", label: "Progress", icon: TrendingUp },
      { to: "/settings", label: "Settings", icon: UserRound },
    ],
  },
];

function getSections(user) {
  if (!user) return [];
  if (user.is_superuser) return SUPERUSER_SECTIONS;
  if (user.role === "admin") return ADMIN_SECTIONS;
  if (user.role === "lecturer") return LECTURER_SECTIONS;
  return STUDENT_SECTIONS;
}

function Brand({ onNavigate, collapsed }) {
  const { user } = useAuth();
  const home = user?.is_superuser ? "/platform" : "/dashboard";
  return (
    <Link
      to={home}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-1 focus-visible:outline-2 focus-visible:outline-ring",
        collapsed ? "justify-center px-0" : "",
      )}
      title={collapsed ? "AcademiAI" : undefined}
    >
      <BrandMark size="h-8 w-8" />
      {!collapsed && (
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          AcademiAI
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ onNavigate, collapsed }) {
  const { user } = useAuth();
  const loc = useLocation();
  const sections = getSections(user);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex-1 space-y-6 overflow-y-auto py-4",
        collapsed ? "px-2" : "px-3",
      )}
    >
      {sections.map((section) => (
        <div key={section.label}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-muted">
              {section.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active =
                loc.pathname === item.to ||
                (item.to !== "/dashboard" &&
                  item.to !== "/admin/dashboard" &&
                  item.to !== "/platform" &&
                  loc.pathname.startsWith(item.to));
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors",
                      collapsed ? "justify-center px-0" : "px-3",
                      active
                        ? "bg-sidebar-active font-medium text-white shadow-sm"
                        : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon
                      className={cn("h-4 w-4 shrink-0", active && "text-white")}
                      aria-hidden
                    />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge === "soon" && (
                          <span className="ml-auto rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ collapsed }) {
  const { user, logout } = useAuth();
  return (
    <div className={cn("space-y-2 border-t border-sidebar-border p-3", collapsed && "p-2")}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg bg-sidebar-hover/60 p-2.5",
          collapsed && "justify-center p-1.5",
        )}
      >
        <Avatar user={user} className="h-9 w-9 shrink-0 ring-2 ring-sidebar-border" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">
              {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : user?.email}
            </p>
            <p className="truncate text-[11px] capitalize text-sidebar-muted">
              {user?.is_superuser ? "Platform operator" : user?.role}
            </p>
          </div>
        )}
        {!collapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="h-8 w-8 shrink-0 text-sidebar-muted hover:bg-transparent hover:text-red-400"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
      {collapsed ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={logout}
          aria-label="Log out"
          title="Log out"
          className="h-9 w-full text-sidebar-muted hover:bg-transparent hover:text-red-400"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </Button>
      ) : (
        <ThemeToggle className="w-full" />
      )}
    </div>
  );
}

function SidebarContent({ onNavigate, collapsed, onToggleCollapse }) {
  return (
    <>
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Brand onNavigate={onNavigate} collapsed={collapsed} />
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="hidden rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground lg:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <SidebarNav onNavigate={onNavigate} collapsed={collapsed} />
      <UserMenu collapsed={collapsed} />
      {collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="hidden border-t border-sidebar-border py-2 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground lg:inline-flex"
        >
          <ChevronRight className="mx-auto h-4 w-4" aria-hidden />
        </button>
      )}
    </>
  );
}

export default function AppShell({ title, description, actions, children, fullBleed = false }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("academiai:sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const loc = useLocation();

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "academiai:sidebar-collapsed",
        collapsed ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const [prevPathname, setPrevPathname] = useState(loc.pathname);
  if (loc.pathname !== prevPathname) {
    setPrevPathname(loc.pathname);
    setMobileOpen(false);
  }

  const sidebarWidth = collapsed ? "lg:w-16" : "lg:w-64";

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col bg-sidebar transition-[width] duration-200 lg:flex",
          sidebarWidth,
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="h-4.5 w-4.5" aria-hidden />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} collapsed={false} onToggleCollapse={() => {}} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div
        className={cn(
          "flex min-h-screen flex-col",
          collapsed ? "lg:pl-16" : "lg:pl-64",
        )}
      >
        {!fullBleed && (
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
            <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
            <div className="ml-auto flex items-center gap-2.5">
              <OnlineStatus />
              <ThemeToggle className="lg:hidden" />
            </div>
          </header>
        )}

        {fullBleed ? (
          <main className="flex h-screen w-full flex-col overflow-hidden">{children}</main>
        ) : (
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <div className="view-enter">
              <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight sm:text-[1.55rem]">
                    {title}
                  </h1>
                  {description ? (
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
                  ) : null}
                </div>
                {actions ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
                ) : null}
              </header>
              {children}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Bookmark,
  ScrollText,
  ShieldCheck,
  StickyNote,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  X,
  CalendarRange,
  CalendarDays,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Learn",
    roles: ["student", "lecturer", "admin"],
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/my-programme", label: "My Programme", icon: Building2, roles: ["student"] },
      { to: "/my-courses", label: "My Courses", icon: GraduationCap, roles: ["student"] },
      { to: "/assigned-courses", label: "Assigned Courses", icon: GraduationCap, roles: ["lecturer", "admin"] },
      { to: "/courses", label: "Catalogue", icon: BookOpen },
    ],
  },
  {
    label: "Resources & AI",
    roles: ["student", "lecturer", "admin"],
    items: [
      { to: "/resources", label: "Resources", icon: FileText },
      { to: "/resources/upload", label: "Upload Material", icon: Upload },
      { to: "/chat", label: "AI Assistant", icon: MessageSquareText },
      { to: "/quizzes", label: "Quizzes", icon: ClipboardList },
    ],
  },
  {
    label: "Personal",
    roles: ["student", "lecturer", "admin"],
    items: [
      { to: "/notes", label: "Notes", icon: StickyNote },
      { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { to: "/progress", label: "Progress", icon: TrendingUp },
      { to: "/profile", label: "Profile", icon: UserRound },
    ],
  },
  {
    label: "Administration",
    roles: ["admin"],
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/faculties", label: "Faculties", icon: Building2 },
      { to: "/admin/departments", label: "Departments", icon: Building2 },
      { to: "/admin/programmes", label: "Programmes", icon: BookOpen },
      { to: "/admin/courses", label: "Courses", icon: GraduationCap },
      { to: "/admin/sessions", label: "Sessions", icon: CalendarRange },
      { to: "/admin/semesters", label: "Semesters", icon: CalendarDays },
      { to: "/admin/offerings", label: "Offerings", icon: ClipboardList },
      { to: "/admin/enrollments", label: "Enrollments", icon: Users },
      { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
      { to: "/admin/tenant", label: "Tenant Settings", icon: ShieldCheck },
    ],
  },
];

function Brand({ onNavigate }) {
  return (
    <Link
      to="/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 py-1 focus-visible:outline-2 focus-visible:outline-ring rounded-md"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <GraduationCap className="h-4.5 w-4.5" aria-hidden />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
        AcademiAI
      </span>
    </Link>
  );
}

function SidebarNav({ onNavigate }) {
  const { user } = useAuth();
  const loc = useLocation();
  const role = user?.role;

  return (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => {
        if (section.roles && !section.roles.includes(role)) return null;
        const items = section.items.filter(
          (i) => !i.roles || i.roles.includes(role)
        );
        if (!items.length) return null;
        return (
          <div key={section.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-muted">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active =
                  loc.pathname === item.to ||
                  (item.to !== "/dashboard" && loc.pathname.startsWith(item.to));
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-active font-medium text-white shadow-sm"
                          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon
                        className={cn("h-4 w-4 shrink-0", active && "text-white")}
                        aria-hidden
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  return (
    <div className="space-y-2 border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3 rounded-lg bg-sidebar-hover/60 p-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/80 text-xs font-semibold uppercase text-primary-foreground">
          {(user?.first_name?.[0] || user?.email?.[0] || "?").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">
            {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : user?.email}
          </p>
          <p className="truncate text-[11px] capitalize text-sidebar-muted">
            {user?.role}
          </p>
        </div>
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
      </div>
      <ThemeToggle className="w-full" />
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  return (
    <>
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <Brand onNavigate={onNavigate} />
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <UserMenu />
    </>
  );
}

export default function AppShell({ title, description, actions, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar lg:flex">
        <SidebarContent />
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
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
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
        </header>

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
      </div>
    </div>
  );
}

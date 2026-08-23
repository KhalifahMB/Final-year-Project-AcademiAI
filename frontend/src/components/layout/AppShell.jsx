import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookOpen, GraduationCap, LayoutDashboard, MessageSquare, FileText, ClipboardList, StickyNote, Bookmark, TrendingUp, User, Shield } from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/courses", label: "Courses", icon: GraduationCap },
  { to: "/resources", label: "Resources", icon: FileText },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/quizzes", label: "Quizzes", icon: ClipboardList },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/profile", label: "Profile", icon: User },
];

const adminNav = [
  { to: "/admin/audit", label: "Audit", icon: Shield },
  { to: "/admin/faculties", label: "Faculties", icon: BookOpen },
];

export default function AppShell({ title, children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const items = user?.role === "admin" ? [...nav, ...adminNav] : nav;

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/dashboard" className="font-bold text-primary shrink-0">
            AcademiAI
          </Link>
          <nav className="hidden md:flex flex-1 gap-1 overflow-x-auto" aria-label="Main">
            {items.map((n) => {
              const Icon = n.icon;
              const active = loc.pathname === n.to || loc.pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[160px]">
              {user?.email} · {user?.role}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {title ? <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}

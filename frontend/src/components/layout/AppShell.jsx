import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  FileText,
  ClipboardList,
  StickyNote,
  Bookmark,
  TrendingUp,
  User,
  Shield,
  Upload,
  Building2,
  Users,
} from 'lucide-react';

export default function AppShell({ title, children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();

  const studentNav = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-programme', label: 'Programme', icon: Building2 },
    { to: '/my-courses', label: 'My courses', icon: GraduationCap },
    { to: '/courses', label: 'Catalogue', icon: BookOpen },
    { to: '/resources', label: 'Resources', icon: FileText },
    { to: '/chat', label: 'AI Chat', icon: MessageSquare },
    { to: '/quizzes', label: 'Quizzes', icon: ClipboardList },
    { to: '/notes', label: 'Notes', icon: StickyNote },
    { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
    { to: '/progress', label: 'Progress', icon: TrendingUp },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  const lecturerExtra = [
    { to: '/assigned-courses', label: 'Assigned', icon: GraduationCap },
    { to: '/resources/upload', label: 'Upload', icon: Upload },
  ];

  const adminNav = [
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/faculties', label: 'Faculties', icon: Building2 },
    { to: '/admin/departments', label: 'Departments', icon: Building2 },
    { to: '/admin/programmes', label: 'Programmes', icon: BookOpen },
    { to: '/admin/courses', label: 'Courses', icon: GraduationCap },
    { to: '/admin/sessions', label: 'Sessions', icon: ClipboardList },
    { to: '/admin/semesters', label: 'Semesters', icon: ClipboardList },
    { to: '/admin/offerings', label: 'Offerings', icon: ClipboardList },
    { to: '/admin/enrollments', label: 'Enrollments', icon: Users },
    { to: '/admin/audit', label: 'Audit', icon: Shield },
    { to: '/admin/tenant', label: 'Tenant', icon: Building2 },
  ];

  let items = [...studentNav];
  if (user?.role === 'lecturer' || user?.role === 'admin')
    items = [...items, ...lecturerExtra];
  if (user?.role === 'admin') items = [...items, ...adminNav];

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link to="/dashboard" className="font-bold text-primary shrink-0">
            AcademiAI
          </Link>
          <nav
            className="hidden lg:flex flex-1 gap-0.5 overflow-x-auto"
            aria-label="Main"
          >
            {items.map((n) => {
              const Icon = n.icon;
              const active =
                loc.pathname === n.to ||
                (n.to !== '/dashboard' && loc.pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs whitespace-nowrap transition-colors',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[140px]">
              {user?.email} · {user?.role}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {title ? (
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
        ) : null}
        {children}
      </main>
    </div>
  );
}

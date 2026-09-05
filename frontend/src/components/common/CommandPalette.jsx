import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'cmdk';
import {
  LayoutDashboard,
  FileText,
  Upload,
  MessageSquare,
  ClipboardList,
  StickyNote,
  BookOpen,
  Bookmark,
  TrendingUp,
  GraduationCap,
  Users,
  ScrollText,
  Building2,
  Settings,
  Sparkles,
  Moon,
  Sun,
  Monitor,
  Search,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

const ICON_CLS = 'mr-2 h-4 w-4 text-muted-foreground';

export default function CommandPalette({ open, onOpen }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const isStaff = user?.role === 'tenant_admin' || user?.is_superuser;
  const isLecturer = user?.role === 'lecturer';

  // Resources for quick navigation (refreshed from cache on open)
  const resources = (() => {
    const list = open ? qc.getQueryData(['resources', user?.role]) || [] : [];
    return Array.isArray(list) ? list.slice(0, 20) : [];
  })();

  // Close on route change
  useEffect(() => {
    if (!open) return;
    const handler = () => onOpen?.(false);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [open, onOpen]);

  const go = (path) => {
    onOpen?.(false);
    setTimeout(() => navigate(path), 10);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpen}
      label="Global command menu"
      loop
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4 [&_[cmdk-item]]:h-9 [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:text-sm"
    >
      <CommandInput
        placeholder="Jump to a page, search materials, or change theme…"
        className="flex h-11 w-full border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <CommandList className="max-h-[60vh] overflow-y-auto pb-2">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-muted-foreground">
            <Search className="h-6 w-6 opacity-40" aria-hidden />
            No results
          </div>
        </CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => go('/')}
            keywords={['home', 'dashboard', 'overview']}
          >
            <LayoutDashboard className={ICON_CLS} aria-hidden /> Dashboard
            <Shortcut>G D</Shortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => go('/chat')}
            keywords={['ai', 'assistant', 'chat', 'messages']}
          >
            <MessageSquare className={ICON_CLS} aria-hidden /> AI Chat
            <Shortcut>G C</Shortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => go('/resources')}
            keywords={['materials', 'library', 'files']}
          >
            <FileText className={ICON_CLS} aria-hidden /> Resources
            <Shortcut>G R</Shortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => go('/resources/upload')}
            keywords={['upload', 'material', 'file', 'new']}
          >
            <Upload className={ICON_CLS} aria-hidden /> Upload material
          </CommandItem>
          <CommandItem
            onSelect={() => go('/quizzes')}
            keywords={['quiz', 'test', 'practice', 'assessment']}
          >
            <ClipboardList className={ICON_CLS} aria-hidden /> Quizzes
          </CommandItem>
          <CommandItem
            onSelect={() => go('/notes')}
            keywords={['notes', 'markdown', 'editor']}
          >
            <StickyNote className={ICON_CLS} aria-hidden /> Notes
          </CommandItem>
          <CommandItem
            onSelect={() => go('/courses')}
            keywords={['catalogue', 'catalog', 'courses']}
          >
            <BookOpen className={ICON_CLS} aria-hidden /> Course catalogue
          </CommandItem>
          <CommandItem
            onSelect={() => go('/my-courses')}
            keywords={['enrolled', 'my', 'classes']}
          >
            <GraduationCap className={ICON_CLS} aria-hidden /> My courses
          </CommandItem>
          <CommandItem
            onSelect={() => go('/bookmarks')}
            keywords={['saved', 'favorites', 'bookmarks']}
          >
            <Bookmark className={ICON_CLS} aria-hidden /> Bookmarks
          </CommandItem>
          <CommandItem
            onSelect={() => go('/progress')}
            keywords={['mastery', 'learning', 'analytics']}
          >
            <TrendingUp className={ICON_CLS} aria-hidden /> Learning progress
          </CommandItem>
          {!isStaff && (
            <CommandItem
              onSelect={() => go('/my-programme')}
              keywords={['program', 'degree', 'department']}
            >
              <Building2 className={ICON_CLS} aria-hidden /> My programme
            </CommandItem>
          )}
          {isLecturer && (
            <CommandItem
              onSelect={() => go('/assigned-courses')}
              keywords={['teaching', 'lecturer', 'assigned']}
            >
              <BookOpen className={ICON_CLS} aria-hidden /> Assigned courses
            </CommandItem>
          )}
          <CommandItem
            onSelect={() => go('/settings')}
            keywords={['profile', 'settings', 'account', 'preferences']}
          >
            <Settings className={ICON_CLS} aria-hidden /> Settings
          </CommandItem>
        </CommandGroup>

        {isStaff && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin">
              <CommandItem
                onSelect={() => go('/platform')}
                keywords={['admin', 'platform', 'dashboard', 'console']}
              >
                <Building2 className={ICON_CLS} aria-hidden /> Platform console
              </CommandItem>
              <CommandItem
                onSelect={() => go('/admin/users')}
                keywords={['people', 'accounts', 'users']}
              >
                <Users className={ICON_CLS} aria-hidden /> Manage users
              </CommandItem>
              <CommandItem
                onSelect={() => go('/admin/quizzes')}
                keywords={['manage', 'quiz', 'editor']}
              >
                <ClipboardList className={ICON_CLS} aria-hidden /> Quiz manager
              </CommandItem>
              <CommandItem
                onSelect={() => go('/admin/audit')}
                keywords={['security', 'logs', 'events', 'audit']}
              >
                <ScrollText className={ICON_CLS} aria-hidden /> Audit logs
              </CommandItem>
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem
            onSelect={() => go('/resources/upload')}
            keywords={['ai', 'generate', 'upload']}
          >
            <Sparkles className={ICON_CLS} aria-hidden /> Upload new material
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => setTheme('light')}>
            <Sun className={ICON_CLS} aria-hidden /> Light
            {theme === 'light' && (
              <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden />
            )}
          </CommandItem>
          <CommandItem onSelect={() => setTheme('dark')}>
            <Moon className={ICON_CLS} aria-hidden /> Dark
            {theme === 'dark' && (
              <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden />
            )}
          </CommandItem>
          <CommandItem onSelect={() => setTheme('system')}>
            <Monitor className={ICON_CLS} aria-hidden /> System
            {theme === 'system' && (
              <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden />
            )}
          </CommandItem>
        </CommandGroup>

        {resources.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent materials">
              {resources.slice(0, 8).map((r) => (
                <CommandItem
                  key={r.id}
                  value={`resource-${r.id}-${r.title}`}
                  keywords={[
                    r.title,
                    r.description || '',
                    r.visibility_scope || '',
                  ]}
                  onSelect={() => go(`/resources`)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onOpen?.(false);
                    // Dispatch event so resources page can open detail dialog
                    window.dispatchEvent(
                      new CustomEvent('academiai:open-resource', { detail: r }),
                    );
                    navigate('/resources');
                  }}
                >
                  <FileText className={ICON_CLS} aria-hidden />
                  <span className="truncate">{r.title}</span>
                  <ArrowRight
                    className="ml-auto h-3.5 w-3.5 text-muted-foreground/40"
                    aria-hidden
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
      <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd>{' '}
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd>{' '}
            select
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">esc</kbd>{' '}
            close
          </span>
        </div>
        <span>⌘K</span>
      </div>
    </CommandDialog>
  );
}

// Inline shortcut pill (cmdk removed CommandShortcut in v1)
function Shortcut({ children }) {
  return (
    <span className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground">
      {typeof children === 'string'
        ? children.split(' ').map((part, i) => (
            <kbd key={i} className="rounded border bg-muted px-1 font-mono">
              {part}
            </kbd>
          ))
        : children}
    </span>
  );
}

// Check icon is rendered inline to avoid importing a component that doesn't exist
function Check({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

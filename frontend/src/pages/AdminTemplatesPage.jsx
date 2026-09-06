import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import SkeletonRows from '@/components/shared/SkeletonRows';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import TemplateEditorDialog from '@/components/shared/TemplateEditorDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { LayoutTemplate, Pencil, Plus, Search, Trash2, Globe, Lock } from 'lucide-react';

const toList = (d) => (Array.isArray(d) ? d : d?.results || []);

function templateStats(t) {
  const milestones = Array.isArray(t?.template_data?.milestones) ? t.template_data.milestones : [];
  const tasks = milestones.reduce((n, m) => n + (Array.isArray(m?.tasks) ? m.tasks.length : 0), 0);
  return { milestones: milestones.length, tasks };
}

export default function AdminTemplatesPage() {
  const qc = useQueryClient();
  const [dialogTemplate, setDialogTemplate] = useState(null); // null = closed, {} = create, template = edit
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const templatesQ = useQuery({
    queryKey: ['admin-plan-templates'],
    queryFn: async () => toList(await plansApi.listTemplates()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-plan-templates'] });

  const deleteMutation = useMutation({
    mutationFn: (id) => plansApi.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      invalidate();
      qc.invalidateQueries({ queryKey: ['plan-templates'] });
    },
    onError: () => toast.error('Could not delete the template'),
  });

  const dialogOpen = dialogTemplate !== null;

  const templates = (templatesQ.data || []).filter((t) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (t.name || '').toLowerCase().includes(s) ||
      (t.description || '').toLowerCase().includes(s) ||
      (t.created_by_name || '').toLowerCase().includes(s)
    );
  });

  return (
    <AppShell
      title="Plan templates"
      description="Reusable study, workflow, and personal plan templates. Public templates are available to everyone in your institution; private templates belong to their creator."
      actions={
        <Button type="button" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => setDialogTemplate({})}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> New template
        </Button>
      }
    >
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates by name or description"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {templatesQ.error && (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription className="flex w-full items-center justify-between gap-3 text-xs">
            <span>Failed to load templates.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => templatesQ.refetch()} className="h-7 shrink-0 text-[11px]">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {templatesQ.isLoading ? (
        <SkeletonRows rows={3} />
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
          <LayoutTemplate className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">
            {search.trim() ? 'No matching templates' : 'No templates yet'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {search.trim()
              ? 'Try a different search.'
              : 'Create a reusable plan template — students can start a personal plan from it in one click.'}
          </p>
          {!search.trim() && (
            <Button type="button" size="sm" onClick={() => setDialogTemplate({})} className="mt-4 h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Create your first template
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl card-surface">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Name</TableHead>
                <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Visibility</TableHead>
                <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Created by</TableHead>
                <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Contents</TableHead>
                <TableHead className="h-9 w-[140px] text-right text-[11px] font-semibold uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => {
                const stats = templateStats(t);
                return (
                  <TableRow key={t.id} className="h-12">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.name}</p>
                          {t.description && (
                            <p className="line-clamp-1 text-[11px] text-muted-foreground">{t.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {t.is_public ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--info-soft)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--info)]">
                          <Globe className="h-3 w-3" aria-hidden /> Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                          <Lock className="h-3 w-3" aria-hidden /> Private
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {t.created_by_name || '—'}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {stats.milestones} milestone{stats.milestones === 1 ? '' : 's'} · {stats.tasks} task{stats.tasks === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDialogTemplate(t)}
                        aria-label={`Edit template ${t.name || ''}`}
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setToDelete(t)}
                        aria-label={`Delete template ${t.name || ''}`}
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TemplateEditorDialog
        key={dialogTemplate ? (dialogTemplate.id || 'new') : 'closed'}
        open={dialogOpen}
        onOpenChange={(o) => !o && setDialogTemplate(null)}
        template={dialogTemplate && dialogTemplate.id ? dialogTemplate : null}
        defaultPublic
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Delete template?"
        description={`“${toDelete?.name || ''}” will be removed from your institution. Existing plans already started from it are unaffected.`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const id = toDelete.id;
          setToDelete(null);
          deleteMutation.mutate(id);
        }}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
      />
    </AppShell>
  );
}
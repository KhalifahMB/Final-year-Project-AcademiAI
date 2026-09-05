import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi } from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import SkeletonRows from '@/components/shared/SkeletonRows';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  ListPlus, LayoutTemplate, Pencil, Plus, Search, Trash2, X,
} from 'lucide-react';

const TYPE_LABELS = {
  study: 'Study Plan',
  workflow: 'Workflow',
  personal: 'Personal',
};

const PLAN_TYPES = ['study', 'workflow', 'personal'];

const toList = (d) => (Array.isArray(d) ? d : d?.results || []);

const emptyTask = () => ({ title: '', description: '', estimated_minutes: '' });
const emptyMilestone = () => ({ title: '', description: '', due_in_days: '', tasks: [emptyTask()] });

function templateToEditor(t) {
  const milestones = Array.isArray(t?.template_data?.milestones)
    ? t.template_data.milestones.map((m) => ({
        title: m.title || '',
        description: m.description || '',
        due_in_days: m.due_in_days ?? '',
        tasks: Array.isArray(m.tasks) && m.tasks.length
          ? m.tasks.map((task) => ({
              title: task.title || '',
              description: task.description || '',
              estimated_minutes: task.estimated_minutes ?? '',
            }))
          : [emptyTask()],
      }))
    : [emptyMilestone()];
  if (milestones.length === 0) milestones.push(emptyMilestone());
  return {
    name: t.name || '',
    description: t.description || '',
    plan_type: t.plan_type || 'study',
    milestones,
  };
}

function freshEditor() {
  return { name: '', description: '', plan_type: 'study', milestones: [emptyMilestone()] };
}

function isValidEditor(e) {
  if (!e.name.trim()) return 'Give the template a name.';
  for (let i = 0; i < e.milestones.length; i += 1) {
    const m = e.milestones[i];
    if (!m.title.trim()) return `Milestone ${i + 1} needs a title.`;
    if (m.due_in_days !== '' && (Number.isNaN(Number(m.due_in_days)) || Number(m.due_in_days) < 0)) {
      return `Milestone ${i + 1} needs due_in_days as days from today (0 or more).`;
    }
    for (let j = 0; j < m.tasks.length; j += 1) {
      const task = m.tasks[j];
      if (!task.title.trim()) return `Task ${j + 1} in milestone ${i + 1} needs a title.`;
      if (
        task.estimated_minutes !== '' &&
        (Number.isNaN(Number(task.estimated_minutes)) || Number(task.estimated_minutes) <= 0)
      ) {
        return `Task "${task.title.trim()}" needs estimated_minutes as minutes above zero.`;
      }
    }
  }
  return '';
}

function editorToPayload(e) {
  const milestones = e.milestones
    .map((m) => ({
      title: m.title.trim(),
      description: m.description.trim(),
      due_in_days: m.due_in_days === '' ? null : Number(m.due_in_days),
      tasks: m.tasks
        .filter((task) => task.title.trim())
        .map((task) => ({
          title: task.title.trim(),
          description: task.description.trim(),
          estimated_minutes: task.estimated_minutes === '' ? null : Number(task.estimated_minutes),
        })),
    }))
    .filter((m) => m.title.trim());
  return {
    name: e.name.trim(),
    description: e.description.trim(),
    plan_type: e.plan_type,
    template_data: { milestones },
  };
}

function templateStats(t) {
  const milestones = Array.isArray(t?.template_data?.milestones) ? t.template_data.milestones : [];
  const tasks = milestones.reduce((n, m) => n + (Array.isArray(m?.tasks) ? m.tasks.length : 0), 0);
  return { milestones: milestones.length, tasks };
}

export default function AdminTemplatesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [editor, setEditor] = useState(freshEditor());

  const templatesQ = useQuery({
    queryKey: ['admin-plan-templates'],
    queryFn: async () => toList(await plansApi.listTemplates()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-plan-templates'] });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? plansApi.updateTemplate(editing.id, editorToPayload(editor))
        : plansApi.createTemplate(editorToPayload(editor)),
    onSuccess: () => {
      toast.success(editing ? 'Template updated' : 'Template created');
      setDialogOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => {
      const errMsg =
        err?.response?.data?.template_data?.[0] ||
        err?.response?.data?.error?.detail ||
        'Save failed';
      setFormError(errMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => plansApi.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      invalidate();
    },
    onError: () => toast.error('Could not delete the template'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setEditor(freshEditor());
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setFormError('');
    setEditor(templateToEditor(t));
    setDialogOpen(true);
  };

  const templates = (templatesQ.data || []).filter((t) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (t.name || '').toLowerCase().includes(s) ||
      (t.description || '').toLowerCase().includes(s)
    );
  });

  const setMilestone = (i, patch) =>
    setEditor((e) => ({
      ...e,
      milestones: e.milestones.map((m, mi) => (mi === i ? { ...m, ...patch } : m)),
    }));
  const setTask = (mi, ti, patch) =>
    setEditor((e) => ({
      ...e,
      milestones: e.milestones.map((m, idx) =>
        idx === mi
          ? { ...m, tasks: m.tasks.map((task, i) => (i === ti ? { ...task, ...patch } : task)) }
          : m,
      ),
    }));

  return (
    <AppShell
      title="Plan templates"
      description="Reusable study, workflow, and personal plan templates your institution's students can start from."
      actions={
        <Button type="button" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={openCreate}>
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
            <Button type="button" size="sm" onClick={openCreate} className="mt-4 h-8 gap-1.5 text-xs">
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
                <TableHead className="h-9 text-[11px] font-semibold uppercase tracking-wider">Type</TableHead>
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
                      <span className="text-xs text-muted-foreground">{TYPE_LABELS[t.plan_type] || t.plan_type}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground">
                      {stats.milestones} milestone{stats.milestones === 1 ? '' : 's'} · {stats.tasks} task{stats.tasks === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(t)}
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

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">{editing ? 'Edit template' : 'New template'}</DialogTitle>
            <DialogDescription className="text-xs">
              Milestones and tasks are copied verbatim when a student starts a plan from this template.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription className="text-xs">{String(formError)}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label htmlFor="tpl-name" className="mb-1 block text-[11px] font-medium text-muted-foreground">Name</label>
                <Input
                  id="tpl-name"
                  value={editor.name}
                  onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Two-week exam sprint"
                  className="h-8 text-sm"
                />
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="tpl-type" className="mb-1 block text-[11px] font-medium text-muted-foreground">Type</label>
                <Select
                  value={editor.plan_type}
                  onValueChange={(v) => setEditor((prev) => ({ ...prev, plan_type: v }))}
                >
                  <SelectTrigger id="tpl-type" className="h-8 w-full text-sm capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt} className="text-sm capitalize">{pt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label htmlFor="tpl-description" className="mb-1 block text-[11px] font-medium text-muted-foreground">Description (optional)</label>
              <Textarea
                id="tpl-description"
                rows={2}
                value={editor.description}
                onChange={(e) => setEditor((prev) => ({ ...prev, description: e.target.value }))}
                className="text-sm"
              />
            </div>

            {/* Milestones editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Milestones</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditor((prev) => ({ ...prev, milestones: [...prev.milestones, emptyMilestone()] }))}
                  className="h-7 gap-1 text-[11px]"
                >
                  <ListPlus className="h-3 w-3" aria-hidden /> Add milestone
                </Button>
              </div>

              {editor.milestones.map((m, mi) => (
                <div key={mi} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid flex-1 gap-2 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label htmlFor={`ms-title-${mi}`} className="mb-1 block text-[10.5px] font-medium text-muted-foreground">
                          Milestone {mi + 1} title
                        </label>
                        <Input
                          id={`ms-title-${mi}`}
                          value={m.title}
                          onChange={(e) => setMilestone(mi, { title: e.target.value })}
                          placeholder="e.g. Week 1 — foundations"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor={`ms-due-${mi}`} className="mb-1 block text-[10.5px] font-medium text-muted-foreground">
                          Due in (days)
                        </label>
                        <Input
                          id={`ms-due-${mi}`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={m.due_in_days}
                          onChange={(e) => setMilestone(mi, { due_in_days: e.target.value })}
                          placeholder="optional"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditor((prev) => ({ ...prev, milestones: prev.milestones.filter((_, i) => i !== mi) }))}
                      aria-label={`Remove milestone ${mi + 1}`}
                      className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <Input
                    aria-label={`Milestone ${mi + 1} description`}
                    value={m.description}
                    onChange={(e) => setMilestone(mi, { description: e.target.value })}
                    placeholder="Milestone description (optional)"
                    className="mt-2 h-8 text-sm"
                  />

                  <div className="mt-3 space-y-1.5">
                    {m.tasks.map((task, ti) => (
                      <div key={ti} className="flex items-center gap-2">
                        <Input
                          aria-label={`Task ${ti + 1} title in milestone ${mi + 1}`}
                          value={task.title}
                          onChange={(e) => setTask(mi, ti, { title: e.target.value })}
                          placeholder={`Task ${ti + 1} title`}
                          className="h-8 flex-1 text-sm"
                        />
                        <div className="w-28">
                          <Input
                            aria-label={`Task ${ti + 1} estimated minutes`}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={task.estimated_minutes}
                            onChange={(e) => setTask(mi, ti, { estimated_minutes: e.target.value })}
                            placeholder="mins"
                            className="h-8 text-sm"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setMilestone(mi, { tasks: m.tasks.filter((_, i) => i !== ti) })}
                          aria-label={`Remove task ${ti + 1} in milestone ${mi + 1}`}
                          className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMilestone(mi, { tasks: [...m.tasks, emptyTask()] })}
                      className="h-7 gap-1 text-[11px] text-primary hover:text-primary"
                    >
                      <Plus className="h-3 w-3" aria-hidden /> Add task
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const errMsg = isValidEditor(editor);
                if (errMsg) {
                  setFormError(errMsg);
                  return;
                }
                setFormError('');
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending}
              className="h-8 gap-1.5 text-xs"
            >
              {saveMutation.isPending ? 'Saving…' : (<><Plus className="h-3.5 w-3.5" /> Save template</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
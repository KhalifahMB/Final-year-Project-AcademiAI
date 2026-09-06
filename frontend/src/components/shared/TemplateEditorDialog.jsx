import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { plansApi } from '@/services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ListPlus, Plus, X } from 'lucide-react';

const PLAN_TYPES = ['study', 'workflow', 'personal'];

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
    is_public: !!t.is_public,
    milestones,
  };
}

function freshEditor(defaultPublic = false) {
  return {
    name: '',
    description: '',
    plan_type: 'study',
    is_public: defaultPublic,
    milestones: [emptyMilestone()],
  };
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
    is_public: !!e.is_public,
    template_data: { milestones },
  };
}

/**
 * Create/edit dialog for plan templates. Works for every tenant role:
 * students, lecturers, and admins may all create reusable templates, then
 * choose whether they are public (institution-wide) or private (creator only).
 *
 * Props:
 *   open            {boolean}   — controlled visibility
 *   onOpenChange    {fn(o)}     — must close via onOpenChange(false)
 *   template        {object|null} — template being edited, or null to create
 *   defaultPublic   {boolean}   — initial visibility for a brand-new template
 *   onSaved         {fn}        — optional; called after a successful save
 *
 * The backend enforces the real rules (creator owns private templates; admins
 * manage public ones); this dialog just prices in the is_public flag.
 */
export default function TemplateEditorDialog({
  open,
  onOpenChange,
  template = null,
  defaultPublic = false,
  onSaved,
}) {
  const qc = useQueryClient();
  const editing = !!template;
  const [prevOpen, setPrevOpen] = useState(null);
  const [editor, setEditor] = useState(() => (template ? templateToEditor(template) : freshEditor(defaultPublic)));
  const [formError, setFormError] = useState('');

  // Reset the form each time the dialog is opened (React-documented
  // "adjusting state during render" pattern — keeps the draft fresh without
  // a set-state-in-effect).
  if (open !== prevOpen) {
    const wasOpen = !!prevOpen;
    setPrevOpen(open);
    if (open && !wasOpen) {
      setEditor(template ? templateToEditor(template) : freshEditor(defaultPublic));
      setFormError('');
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? plansApi.updateTemplate(template.id, editorToPayload(editor))
        : plansApi.createTemplate(editorToPayload(editor)),
    onSuccess: () => {
      toast.success(editing ? 'Template updated' : 'Template created');
      qc.invalidateQueries({ queryKey: ['plan-templates'] });
      qc.invalidateQueries({ queryKey: ['admin-plan-templates'] });
      setFormError('');
      if (onSaved) onSaved();
      onOpenChange(false);
    },
    onError: (err) => {
      const errMsg =
        err?.response?.data?.template_data?.[0] ||
        err?.response?.data?.error?.detail ||
        'Save failed';
      setFormError(errMsg);
    },
  });

  const canSave = saveMutation.isPending;

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
    <Dialog open={open} onOpenChange={(o) => !o && !canSave && onOpenChange(false)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{editing ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription className="text-xs">
            Milestones and tasks are copied verbatim when someone starts a plan from this template.
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

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-[var(--surface-2)] p-3">
            <Checkbox
              checked={editor.is_public}
              onCheckedChange={(v) => setEditor((prev) => ({ ...prev, is_public: !!v }))}
              aria-label="Make this template public"
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold">Public template</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                Public templates are visible to your whole institution. Leave this off to keep the
                template private — only you can see and use it.
              </span>
            </span>
          </label>

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
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={canSave}>
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
            disabled={canSave}
            className="h-8 gap-1.5 text-xs"
          >
            {saveMutation.isPending ? 'Saving…' : (<><Plus className="h-3.5 w-3.5" /> Save template</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
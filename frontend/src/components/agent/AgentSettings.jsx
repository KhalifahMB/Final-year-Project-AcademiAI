import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bot, Check, Loader2, Upload, X } from 'lucide-react';
import { useAgent } from '@/hooks/useAgent';
import { agentApi } from '@/services/api';
import { toast } from 'sonner';

const TONES = [
  { value: 'concise', label: 'Concise', desc: 'Short, pointed answers' },
  { value: 'balanced', label: 'Balanced', desc: 'Measured, well-rounded' },
  { value: 'coach', label: 'Coach', desc: 'Encouraging, pushes you' },
];

// Curated avatar set (no emojis): authored SVG glyphs shipped with the app.
const AVATAR_OPTIONS = [
  { src: '/avatars/tutor.svg', label: 'Scholar' },
  { src: '/avatars/mentor.svg', label: 'Mentor' },
  { src: '/avatars/planner.svg', label: 'Planner' },
  { src: '/avatars/librarian.svg', label: 'Librarian' },
  { src: '/avatars/analyst.svg', label: 'Analyst' },
  { src: '/avatars/exec.svg', label: 'Executive' },
];

export default function AgentSettings({ embedded = false, onClose } = {}) {
  const { agents, agentKey, setAgent, settings, saveSettings, identity } =
    useAgent();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const busy = saving || !agents.length;

  const update = (patch) => {
    if (typeof patch === 'function') patch = patch(settings);
    saveSettings(patch);
  };

  const persist = async (patch) => {
    setSaving(true);
    try {
      await saveSettings(patch);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { avatar } = await agentApi.uploadAvatar(file);
      update({ avatar });
      toast.success('Agent avatar updated');
    } catch {
      toast.error('Could not upload that image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={cn(
        'space-y-4',
        !embedded &&
          'rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
          <Bot className="h-4 w-4 text-[var(--accent)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-[620]">AI Agent Widget</p>
          <p className="truncate text-[11px] text-[var(--muted)]">
            Your {identity?.name || 'AI'} assistant on every screen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => persist({ enabled: !settings.enabled })}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            settings.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)] border border-[var(--border)]',
          )}
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Toggle AI agent widget"
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
              settings.enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
            )}
          />
        </button>
        {embedded && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close agent settings"
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {busy && !settings.enabled ? (
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading agent settings…
        </p>
      ) : null}

      <div className="space-y-3">
        <div>
          <label
            htmlFor="agent-default"
            className="mb-1 block text-[11px] font-[600] uppercase tracking-wide text-[var(--muted)]"
          >
            Default agent
          </label>
          <div className="flex flex-wrap gap-1.5">
            {agents.map((a) => (
              <button
                key={a.key}
                id={a.key === agentKey ? 'agent-default' : undefined}
                type="button"
                onClick={() => setAgent(a.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                  a.key === agentKey
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]',
                )}
              >
                <img src={a.avatar} alt="" className="h-4 w-4 rounded-full" />
                {a.name}
                {a.key === agentKey && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-[11px] font-[600] uppercase tracking-wide text-[var(--muted)]">
            Response style
          </span>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update({ tone: t.value })}
                title={t.desc}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                  (settings.tone || 'balanced') === t.value
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-[var(--border)] pt-3">
          <span className="block text-[11px] font-[600] uppercase tracking-wide text-[var(--muted)]">
            Avatar
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {AVATAR_OPTIONS.map((opt) => {
              const active =
                settings.avatar === opt.src
                  ? 1
                  : !settings.avatar && identity?.avatar === opt.src
                    ? 1
                    : 0;
              return (
                <button
                  key={opt.src}
                  type="button"
                  title={opt.label}
                  aria-label={`Use ${opt.label} avatar`}
                  aria-pressed={active === 1}
                  onClick={() => update({ avatar: opt.src })}
                  className={cn(
                    'relative h-9 w-9 overflow-hidden rounded-full ring-2 transition-all',
                    active
                      ? 'ring-[var(--accent)]'
                      : 'ring-[var(--border)] hover:ring-[var(--accent)]/50',
                  )}
                >
                  <img
                    src={opt.src}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  {active === 1 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-[var(--accent)]/25">
                      <Check className="h-4 w-4 text-[var(--accent-strong)]" />
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-9 items-center gap-1.5 rounded-full border border-dashed border-[var(--border)] px-2.5 text-[11.5px] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--fg)]"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleAvatarFile}
            />
            {settings.avatar && !AVATAR_OPTIONS.some((o) => o.src === settings.avatar) && (
              <span
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-[var(--accent)]"
                title="Custom upload (click avatar option to switch back)"
              >
                <img
                  src={settings.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </span>
            )}
          </div>
          <p className="truncate text-[10.5px] text-[var(--muted)]">
            {settings.avatar
              ? 'Custom avatar applied'
              : `Default for ${identity?.name || 'agent'}. Pick any avatar or upload your own.`}
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            role="switch"
            aria-checked={settings.reminders_enabled !== false}
            aria-label="Study reminder practice"
            onClick={() =>
              update({ reminders_enabled: settings.reminders_enabled === false })
            }
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              settings.reminders_enabled !== false
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--surface-2)] border border-[var(--border)]',
            )}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
                settings.reminders_enabled !== false
                  ? 'translate-x-[18px]'
                  : 'translate-x-0.5',
              )}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-[560] leading-tight">
              Study reminders
            </p>
            <p className="truncate text-[10.5px] text-[var(--muted)]">
              nudge me about upcoming deadlines
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
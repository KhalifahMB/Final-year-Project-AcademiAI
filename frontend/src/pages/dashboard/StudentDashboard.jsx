/**
 * Student Dashboard (Phase F) — Open Design modern-minimal layout.
 *
 * Sections:
 *  1. Greeting + "Ask anything" CTA
 *  2. Up next (quiz due-dates)
 *  3. Continue learning (2-col course cards w/ progress meter)
 *  4. Study activity filled area chart (This week / vs last week / Streak stats)
 *  5. Sidebar stats grid (Concept mastery colored bars)
 *  6. New in library (recent resources)
 *
 * Backend contracts stay intact — reads the same aggregate payload.
 */
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  MessageSquareText,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { TimeAgo } from './DashboardPage.helpers';
import { greeting } from '@/lib/utils';

/* ---------------------------------------------------------------- */
/* Small atoms                                                       */
/* ---------------------------------------------------------------- */

function Meter({ pct, tone = 'accent' }) {
  const toneColor = {
    accent: 'bg-[var(--accent)]',
    ok: 'bg-[var(--success)]',
    warn: 'bg-[var(--warn)]',
    bad: 'bg-[var(--danger)]',
  }[tone];
  return (
    <span className="meter" aria-label={`${pct}%`}>
      <span className={toneColor} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
    </span>
  );
}

function Pill({ children, tone = 'soft' }) {
  const tones = {
    soft: 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)] border-transparent',
    ok: 'bg-[var(--success-soft)] text-[var(--success)] border-transparent',
    warn: 'bg-[var(--warn-soft)] text-[var(--warn)] border-transparent',
    bad: 'bg-[var(--danger-soft)] text-[var(--danger)] border-transparent',
    info: 'bg-[var(--info-soft)] text-[var(--info)] border-transparent',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-[600] ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Sections                                                          */
/* ---------------------------------------------------------------- */

function UpNext({ items }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow !mb-0">Up next</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            Things ready for you
          </h3>
        </div>
        <Link
          to="/quizzes"
          className="inline-flex items-center gap-0.5 text-[12px] font-[600] text-[var(--accent-strong)] hover:underline"
        >
          All quizzes
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <CalendarClock className="mx-auto h-5 w-5 text-[var(--muted)]" aria-hidden />
          <p className="mt-2 text-[13px] font-[600]">You’re all caught up</p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            No quizzes or deadlines are waiting — try a practice set.
          </p>
        </div>
      ) : (
        <ul className="-mx-2 space-y-1">
          {items.slice(0, 5).map((it) => (
            <li key={it.id}>
              <Link
                to={it.kind === 'quiz' ? `/quizzes/${it.id}` : '#'}
                className="group flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 transition-colors hover:bg-[var(--hover)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  {it.kind === 'quiz' ? (
                    <ClipboardList className="h-[16px] w-[16px]" aria-hidden />
                  ) : (
                    <BookOpenCheck className="h-[16px] w-[16px]" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-[600]">{it.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                    {it.context && <span className="font-mono">{it.context}</span>}
                    {it.context && <span aria-hidden>·</span>}
                    <span>{it.when_label}</span>
                  </p>
                </div>
                <Pill tone={it.status === 'due_soon' ? 'warn' : 'accent'}>
                  {it.status === 'due_soon' ? 'Due soon' : 'Available'}
                </Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConceptMastery({ items }) {
  return (
    <section className="card p-5">
      <div className="mb-4">
        <p className="eyebrow !mb-0">Concept mastery</p>
        <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
          How you’re tracking
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-[var(--muted)]">
          Take a quiz to start building your mastery signal.
        </p>
      ) : (
        <ul className="space-y-3.5">
          {items.slice(0, 5).map((c) => {
            const pct = Math.max(0, Math.min(100, c.pct));
            const tone = pct >= 75 ? 'ok' : pct >= 50 ? 'accent' : pct >= 30 ? 'warn' : 'bad';
            return (
              <li key={c.name}>
                <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="truncate font-[520] text-[var(--fg-soft)]">{c.name}</span>
                  <span className="num font-[620] text-[var(--fg)]">{pct}%</span>
                </div>
                <Meter pct={pct} tone={tone} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ContinueLearning({ courses }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow !mb-0">Continue learning</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            Pick up where you left off
          </h3>
        </div>
        <Link
          to="/my-courses"
          className="inline-flex items-center gap-0.5 text-[12px] font-[600] text-[var(--accent-strong)] hover:underline"
        >
          All courses
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {courses.length === 0 ? (
        <p className="text-[12.5px] text-[var(--muted)]">
          No courses yet. Once you’re enrolled they’ll appear here.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.slice(0, 4).map((c) => {
            const tone = c.status === 'on_track' ? 'ok' : 'warn';
            return (
              <Link
                key={c.id}
                to={`/courses/${c.id}`}
                className="group rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-4 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-8 min-w-0 items-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-2 font-mono text-[11px] font-[650] text-[var(--accent-strong)]">
                    {c.code}
                  </span>
                  <Pill tone={tone}>
                    {c.status === 'on_track' ? 'On track' : 'Behind'}
                  </Pill>
                </div>
                <p className="mt-3 truncate text-[13.5px] font-[620] leading-snug">
                  {c.title}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                  {c.semester || 'Current semester'}
                </p>
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[11.5px] text-[var(--muted)]">
                    <span>Progress</span>
                    <span className="num font-[600] text-[var(--fg)]">
                      {c.progress_pct}%
                    </span>
                  </div>
                  <Meter pct={c.progress_pct} tone={tone} />
                </div>
                {c.last_accessed && (
                  <p className="mt-2.5 flex items-center gap-1 text-[11.5px] text-[var(--muted)]">
                    <Clock className="h-3 w-3" aria-hidden />
                    <TimeAgo iso={c.last_accessed} />
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StudyActivity({ chartData, range, onChangeRange, loading, statsRow }) {
  return (
    <section className="card p-5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow !mb-0">Study activity</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            Your week, at a glance
          </h3>
        </div>
        <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-[11.5px]">
          {[
            { id: 'day', label: 'Day' },
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChangeRange(o.id)}
              className={`rounded-[var(--radius-sm)] px-2.5 py-1 font-[600] transition-colors ${
                range === o.id
                  ? 'bg-[var(--surface)] text-[var(--fg)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {statsRow && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {statsRow.map((s) => (
            <div
              key={s.label}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-3"
            >
              <p className="flex items-center gap-1 text-[11px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
                {s.icon}
                {s.label}
              </p>
              <p className="mt-1 text-[18px] font-[650] tracking-[-0.02em] num">
                {s.value}
              </p>
              {s.hint && (
                <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">{s.hint}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 h-60">
        {loading ? (
          <div className="h-full animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-[12.5px] text-[var(--muted)]">
            Start a chat or take a quiz to see your study patterns.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="studyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  if (range === 'month') return d.toLocaleDateString([], { month: 'short' });
                  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: 'var(--shadow-pop)',
                }}
                labelFormatter={(v) => new Date(v).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Activity"
                stroke="var(--accent-strong)"
                strokeWidth={2}
                fill="url(#studyFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function NewInLibrary({ items }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow !mb-0">New in library</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            Fresh materials for your courses
          </h3>
        </div>
        <Link
          to="/resources"
          className="inline-flex items-center gap-0.5 text-[12px] font-[600] text-[var(--accent-strong)] hover:underline"
        >
          Browse all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-[var(--muted)]">
          No new uploads yet. Check back after your lecturer adds materials.
        </p>
      ) : (
        <ul className="-mx-2 space-y-1">
          {items.slice(0, 5).map((r) => (
            <li key={r.id}>
              <Link
                to="/resources"
                className="group flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 transition-colors hover:bg-[var(--hover)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-2)] text-[var(--muted)]">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-[600]">{r.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11.5px] capitalize text-[var(--muted)]">
                    {r.visibility_scope}
                    <span aria-hidden>·</span>
                    <Clock className="h-3 w-3" aria-hidden />
                    <TimeAgo iso={r.updated_at || r.created_at} />
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--faint)] transition-colors group-hover:text-[var(--accent-strong)]" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickCTA({ firstName }) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-5 dark:bg-[var(--accent-soft)]">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow !mb-0 !text-[var(--accent-strong)]">Ask anything</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            {firstName}, your AI tutor is ready.
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--fg-soft)]">
            Ask a question about any of your enrolled courses — every answer
            cites the slide, page or passage it came from.
          </p>
          <Link
            to="/chat"
            className="mt-3 inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[13px] font-[620] text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-strong)]"
          >
            Open AI tutor
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Compute stats for the Study Activity summary row                  */
/* ---------------------------------------------------------------- */

function deriveActivityStats(timeline) {
  if (!timeline || timeline.length === 0) {
    return [
      { label: 'This week', value: '0m', hint: 'No activity yet', icon: <Clock className="mr-1 h-3 w-3" aria-hidden /> },
      { label: 'vs last week', value: '+0', hint: 'Start a session', icon: <TrendingUp className="mr-1 h-3 w-3" aria-hidden /> },
      { label: 'Streak', value: '0 days', hint: 'Keep it going', icon: <Flame className="mr-1 h-3 w-3" aria-hidden /> },
    ];
  }
  // Each "count" is an event; approximate minutes by weighting.
  const toMins = (events) => events * 6;
  const mid = Math.floor(timeline.length / 2);
  const recent = timeline.slice(mid).reduce((a, p) => a + (p.chats + p.quizzes + p.notes), 0);
  const prior = timeline.slice(0, mid).reduce((a, p) => a + (p.chats + p.quizzes + p.notes), 0);
  const recentMins = toMins(recent);
  const priorMins = toMins(prior);
  const diff = recentMins - priorMins;
  const h = Math.floor(recentMins / 60);
  const m = recentMins % 60;
  const recentStr = h > 0 ? `${h}h${m > 0 ? m : ''}m` : `${m}m`;
  const diffStr = diff >= 0 ? `+${diff}m` : `-${Math.abs(diff)}m`;
  // streak = trailing consecutive buckets with >=1 event
  let streak = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const p = timeline[i];
    if ((p.chats + p.quizzes + p.notes) > 0) streak += 1;
    else break;
  }
  return [
    { label: 'This period', value: recentStr, hint: 'Chats + quizzes + notes', icon: <Clock className="mr-1 h-3 w-3" aria-hidden /> },
    { label: 'vs last', value: diffStr, hint: priorMins === 0 ? 'New activity 🎉' : 'Period over period', icon: <TrendingUp className="mr-1 h-3 w-3" aria-hidden /> },
    { label: 'Streak', value: `${streak} day${streak === 1 ? '' : 's'}`, hint: 'Active days in a row', icon: <Flame className="mr-1 h-3 w-3" aria-hidden /> },
  ];
}

function buildTotalSeries(timeline) {
  return (timeline || []).map((p) => ({ ...p, total: (p.chats || 0) + (p.quizzes || 0) + (p.notes || 0) }));
}

/* ---------------------------------------------------------------- */
/* Exported view                                                     */
/* ---------------------------------------------------------------- */

export default function StudentDashboard({ dash, studentActivity, studentRange, setStudentRange, firstName }) {
  const counts = dash?.counts || {};
  const upNext = dash?.up_next || [];
  const continueCourses = dash?.continue_courses || [];
  const concepts = dash?.concept_mastery || [];
  const recentResources = dash?.recent_resources || [];
  const timeline = studentActivity?.timeline || [];
  const chartData = buildTotalSeries(timeline);

  // KPI strip
  const kpis = [
    { icon: GraduationCap, label: 'Enrolled', value: counts.enrollments ?? 0, hint: 'courses' },
    { icon: MessageSquareText, label: 'AI chats', value: counts.chats ?? 0, hint: 'sessions' },
    { icon: ClipboardList, label: 'Quizzes', value: counts.quiz_attempts ?? 0, hint: 'attempts' },
    { icon: FileText, label: 'Materials', value: counts.resources ?? 0, hint: 'available' },
  ];

  return (
    <>
      {/* Greeting */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-[var(--warn)]" aria-hidden />
            {greeting()}
          </p>
          <h1 className="mt-1 text-[30px] font-[650] leading-[1.08] tracking-[-0.02em]">
            Hi {firstName}
            <span className="text-[var(--muted)] font-[450]"> — welcome back.</span>
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--muted)]">
            Here’s what’s waiting in your study workspace today.
          </p>
        </div>
        <Link
          to="/chat"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[13px] font-[620] text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-strong)]"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Ask anything
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(({ icon: I, label, value, hint }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <I className="h-4 w-4" aria-hidden />
              </span>
              <p className="text-[11.5px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
                {label}
              </p>
            </div>
            <p className="mt-3 text-[24px] font-[650] leading-none tracking-[-0.02em] num">
              {value}
            </p>
            <p className="mt-1 text-[12px] text-[var(--muted)]">{hint}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <ContinueLearning courses={continueCourses} />
          <StudyActivity
            chartData={chartData}
            range={studentRange}
            onChangeRange={setStudentRange}
            loading={studentActivity.isLoading}
            statsRow={deriveActivityStats(timeline)}
          />
        </div>
        <div className="space-y-5">
          <QuickCTA firstName={firstName} />
          <UpNext items={upNext} />
          <ConceptMastery items={concepts} />
        </div>
      </div>

      {/* Full-width new library */}
      <div className="mt-5">
        <NewInLibrary items={recentResources} />
      </div>
    </>
  );
}

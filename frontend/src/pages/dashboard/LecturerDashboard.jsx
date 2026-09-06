/**
 * Lecturer Dashboard (Phase G) — Open Design modern-minimal layout.
 *
 * Sections:
 *  1. WORKSPACE eyebrow hero + today's date + "Upload material" CTA
 *  2. 6 KPI tiles (active_courses / students_enrolled / concepts_flagged /
 *     quiz_submissions / quiz_completion_pct / ai_answers_today)
 *  3. Students needing attention table (at_risk / watch / ok badges)
 *  4. Weak concepts horizontal bars with course code + attempts
 *  5. Asked-about-materials feed (quote + student + course chip + similarity)
 *  6. Material ingestion pipeline (ready / indexing / failed)
 *
 * Backend contract: apps/common/dashboard.py#LecturerDashboardView
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  DatabaseZap,
  FileText,
  GraduationCap,
  MessageSquareText,
  Plus,
  Sparkles,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';

import { TimeAgo, Meter } from './DashboardPage.helpers';
import { greeting } from '@/lib/utils';
import { dashboardApi } from '@/services/api';
import AiInsightCard from '@/components/shared/AiInsightCard';

/* ---------------------------------------------------------------- */
/* Small atoms                                                       */
/* ---------------------------------------------------------------- */

function KpiTile({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] ${accent || 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'}`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-[11.5px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
          {label}
        </p>
      </div>
      <p className="mt-3 text-[24px] font-[650] leading-none tracking-[-0.02em] num">
        {value}
      </p>
      {hint && <p className="mt-1 text-[12px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    at_risk: { cls: 'bg-[var(--danger-soft)] text-[var(--danger)]', label: 'At risk', Icon: XCircle },
    watch:   { cls: 'bg-[var(--warn-soft)] text-[var(--warn)]',     label: 'Watch',   Icon: AlertTriangle },
    ok:      { cls: 'bg-[var(--success-soft)] text-[var(--success)]', label: 'On track', Icon: CheckCircle2 },
  };
  const { cls, label, Icon } = map[status] || map.ok;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-[600] ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Sections                                                          */
/* ---------------------------------------------------------------- */

function Pipeline({ pipeline }) {
  const items = [
    { key: 'ready',    label: 'Ready',    value: pipeline?.ready    || 0, Icon: CheckCircle2, tone: 'text-[var(--success)]' },
    { key: 'indexing', label: 'Indexing', value: pipeline?.indexing || 0, Icon: HardHat,     tone: 'text-[var(--warn)]' },
    { key: 'failed',   label: 'Failed',   value: pipeline?.failed   || 0, Icon: DatabaseZap, tone: 'text-[var(--danger)]' },
  ];
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow !mb-0">Pipeline</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            Material ingestion
          </h3>
        </div>
        <Link
          to="/resources/upload"
          className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-[600] transition-colors hover:bg-[var(--hover)]"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Upload
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.key} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)]/40 p-3 text-center">
            <it.Icon className={`mx-auto h-5 w-5 ${it.tone}`} aria-hidden />
            <p className="mt-2 text-[20px] font-[650] leading-none num">{it.value}</p>
            <p className="mt-0.5 text-[11px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">{it.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[var(--hover)]" role="img" aria-label={`Material ingestion: ${pipeline?.ready || 0} ready, ${pipeline?.indexing || 0} indexing, ${pipeline?.failed || 0} failed`}>
        {items.map((it) => {
          const w = (it.value / total) * 100;
          if (w <= 0) return null;
          const bg = it.key === 'ready' ? 'var(--success)' : it.key === 'indexing' ? 'var(--warn)' : 'var(--danger)';
          return <span key={it.key} style={{ width: `${w}%`, background: bg }} />;
        })}
      </div>
    </section>
  );
}

function StudentsNeedingAttention({ rows }) {
  return (
    <section className="card p-5 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow !mb-0">Students needing attention</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            Reach out before the exam does
          </h3>
        </div>
        <span className="text-[12px] font-[600] text-[var(--muted)] num">
          {rows.length} student{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-[12.5px] text-[var(--muted)]">
          No students are flagged yet — check back after more quiz attempts.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Students needing attention, sorted by risk</caption>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]/60 text-[11px] font-[600] uppercase tracking-[0.08em] text-[var(--muted)]">
                <th scope="col" className="py-2.5 pl-4 pr-2 text-left">Student</th>
                <th scope="col" className="px-2 text-right">Avg score</th>
                <th scope="col" className="px-2 text-right">Attempts</th>
                <th scope="col" className="py-2.5 pl-2 pr-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.student_id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)]/40">
                  <td className="py-2.5 pl-4 pr-2">
                    <p className="font-[600]">{s.name}</p>
                  </td>
                  <td className="px-2 text-right num font-[620]">{s.avg_score}%</td>
                  <td className="px-2 text-right num text-[var(--muted)]">{s.attempts}</td>
                  <td className="py-2.5 pl-2 pr-4 text-right">
                    <StatusPill status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function WeakConcepts({ items }) {
  return (
    <section className="card p-5">
      <div className="mb-4">
        <p className="eyebrow !mb-0">Concept confusion</p>
        <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
          Topics to reinforce
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-[var(--muted)]">
          No quiz data yet — publish a quiz to start tracking mastery.
        </p>
      ) : (
        <ul className="space-y-3.5">
          {items.slice(0, 5).map((w, i) => {
            const pct = Math.max(0, Math.min(100, w.mastery_pct));
            const tone = pct >= 75 ? 'ok' : pct >= 50 ? 'accent' : pct >= 30 ? 'warn' : 'bad';
            return (
              <li key={w.quiz_id || i}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="truncate">
                    <span className="mr-1.5 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[10.5px] font-[650] text-[var(--accent-strong)]">
                      {w.course_code}
                    </span>
                    <span className="font-[600] text-[var(--fg-soft)]">{w.label}</span>
                  </span>
                  <span className="num font-[620]">{pct}%</span>
                </div>
                <Meter pct={pct} tone={tone} />
                <p className="mt-1 text-[11px] text-[var(--muted)] num">
                  {w.attempts} attempt{w.attempts === 1 ? '' : 's'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to="/quizzes"
        className="mt-5 inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[13px] font-[620] text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-strong)]"
      >
        Generate reinforcement quiz
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  );
}

function AskedAbout({ items }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow !mb-0">Asked about your materials</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            What students are asking the AI
          </h3>
        </div>
        <Link
          to="/chat"
          className="inline-flex items-center gap-0.5 text-[12px] font-[600] text-[var(--accent-strong)] hover:underline"
        >
          Open tutor
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-[var(--muted)]">
          Student questions citing your materials will appear here.
        </p>
      ) : (
        <ul className="-mx-2 space-y-1">
          {items.slice(0, 5).map((a, i) => (
            <li key={`${a.created_at || 'no-date'}-${a.quote?.slice(0, 24) || i}`} className="rounded-[var(--radius-md)] px-2 py-2 transition-colors hover:bg-[var(--hover)]">
              <div className="flex items-center gap-2 text-[11.5px]">
                <span className="font-[600]">{a.student_name}</span>
                {a.course_code && (
                  <span className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--muted)]">
                    {a.course_code}
                  </span>
                )}
                {a.similarity != null && (
                  <span className="ml-auto font-mono text-[var(--muted)] num">
                    sim {a.similarity.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--fg-soft)]">
                “{a.quote}”
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11.5px] text-[var(--muted)]">
                <FileText className="h-3 w-3" aria-hidden />
                <span className="truncate">{a.resource_title}</span>
                {a.created_at && (
                  <>
                    <span aria-hidden>·</span>
                    <Clock className="h-3 w-3" aria-hidden />
                    <TimeAgo iso={a.created_at} />
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickGenerate() {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
          <Bot className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow !mb-0 !text-[var(--accent-strong)]">AI co-pilot</p>
          <h3 className="mt-1 text-[15px] font-[640] tracking-[-0.01em]">
            Generate a quiz from this week's slides.
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--fg-soft)]">
            Pick a lecture, review the draft, then publish to your cohort. Answers feed straight into concept mastery.
          </p>
          <Link
            to="/quizzes"
            className="mt-3 inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[13px] font-[620] text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-strong)]"
          >
            New quiz
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Exported view                                                     */
/* ---------------------------------------------------------------- */

export default function LecturerDashboard({ dash, firstName }) {
  const k = dash?.kpis || {};
  const students = dash?.students_needing_attention || [];
  const weak = dash?.weak_concepts || [];
  const asked = dash?.asked_about_materials || [];
  const pipeline = dash?.pipeline || {};
  const workspace = dash?.workspace || 'LECTURER WORKSPACE';

  const { data: aiGreeting } = useQuery({
    queryKey: ['ai-greeting'],
    queryFn: dashboardApi.aiGreeting,
    staleTime: 3600000, // 1 hour
    retry: 1,
  });

  const kpis = [
    { icon: GraduationCap,      label: 'Active courses',     value: k.active_courses ?? 0,    hint: 'Assigned this term' },
    { icon: Users,              label: 'Students enrolled',  value: k.students_enrolled ?? 0, hint: 'Across your courses' },
    { icon: AlertTriangle,      label: 'Concepts flagged',   value: k.concepts_flagged ?? 0,  hint: 'Below 50% mastery', accent: 'bg-[var(--danger-soft)] text-[var(--danger)]' },
    { icon: ClipboardList,      label: 'Quiz submissions',   value: k.quiz_submissions ?? 0,  hint: `${k.quiz_completion_pct ?? 0}% completion` },
    { icon: MessageSquareText,  label: 'AI answers today',   value: k.ai_answers_today ?? 0,  hint: 'Citing your materials' },
    { icon: FileText,           label: 'Materials ready',    value: pipeline?.ready ?? 0,     hint: 'Indexed & searchable' },
  ];

  return (
    <>
      {/* Hero */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <GraduationCap className="h-3 w-3 text-[var(--accent-strong)]" aria-hidden />
            {workspace}
          </p>
          <h1 className="mt-1 text-[30px] font-[650] leading-[1.08] tracking-[-0.02em]">
            {aiGreeting?.greeting || greeting()}, {firstName}
            <span className="text-[var(--muted)] font-[450]"> — here's your cohort.</span>
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--muted)]">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {students.length} student{students.length === 1 ? '' : 's'} flagged · {k.ai_answers_today ?? 0} AI answers today
          </p>
        </div>
        <Link
          to="/resources/upload"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-[13px] font-[620] text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-strong)]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Upload material
        </Link>
      </div>

      <AiInsightCard dashboardType="lecturer" className="mb-6" />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <KpiTile key={k.label} {...k} />
        ))}
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <StudentsNeedingAttention rows={students} />
          <div className="grid gap-5 md:grid-cols-2">
            <Pipeline pipeline={pipeline} />
            <QuickGenerate />
          </div>
        </div>
        <div className="space-y-5">
          <WeakConcepts items={weak} />
          <AskedAbout items={asked} />
        </div>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
 ArrowLeft,
 CheckCircle2,
 ChevronLeft,
 ChevronRight,
 Clock,
 Flag,
 HelpCircle,
 ListChecks,
 RotateCcw,
 Sparkles,
 Trophy,
 XCircle,
} from 'lucide-react';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function QuizTakePage() {
 const { id } = useParams();
 const navigate = useNavigate();
 const { user } = useAuth();
 const qc = useQueryClient();
 const isStaff = user?.role === 'lecturer' || user?.role === 'admin' || user?.is_superuser;

 const [answers, setAnswers] = useState({});
 const [attemptId, setAttemptId] = useState(null);
 const [result, setResult] = useState(null);
 const [currentIdx, setCurrentIdx] = useState(0);
 const [flagged, setFlagged] = useState({});
 const [reviewIdx, setReviewIdx] = useState(0);

 const quiz = useQuery({
 queryKey: ['quiz', id],
 queryFn: async () => (await api.get(`/quizzes/${id}/`)).data,
 enabled: !!id,
 });

 const attempts = useQuery({
 queryKey: ['quiz-attempts-mine', id],
 queryFn: async () => {
 const { data } = await api.get('/quiz-attempts/', { params: { quiz: id, page_size: 20 } });
 return data.results || data || [];
 },
 enabled: !!id && !isStaff,
 });

 const questions = useQuery({
 queryKey: ['quiz-questions', id],
 queryFn: async () => {
 const { data } = await api.get('/quiz-questions/', { params: { quiz: id } });
 return data.results || data;
 },
 enabled: !!id,
 });

// Reset local quiz state whenever the quiz id changes. Adjusted during
 // render (not in an effect) so the quiz states never leak between quizzes.
 const [prevQuizKey, setPrevQuizKey] = useState(id);
 if (id !== prevQuizKey) {
 setPrevQuizKey(id);
 setAnswers({});
 setAttemptId(null);
 setResult(null);
 setCurrentIdx(0);
 setFlagged({});
 setReviewIdx(0);
 }

 const start = useMutation({
 mutationFn: () => api.post('/quiz-attempts/', { quiz: id }),
 onSuccess: (res) => {
 setAttemptId(res.data.id);
 setAnswers({});
 setResult(null);
 setCurrentIdx(0);
 toast.success('Attempt started');
 qc.invalidateQueries({ queryKey: ['quiz-attempts-mine', id] });
 },
 onError: (err) => {
 const detail = err.response?.data?.detail || 'Could not start attempt';
 toast.error(detail);
 },
 });

 const submit = useMutation({
 mutationFn: () => api.post(`/quiz-attempts/${attemptId}/submit/`, { answers }),
 onSuccess: (res) => {
 setResult(res.data);
 setReviewIdx(0);
 toast.success('Submitted');
 qc.invalidateQueries({ queryKey: ['quiz-attempts-mine', id] });
 qc.invalidateQueries({ queryKey: ['quizzes'] });
 },
 onError: (err) => {
 const d = err.response?.data?.error?.detail || err.response?.data?.detail;
 toast.error(typeof d === 'string' ? d : 'Submit failed');
 },
 });

 const retake = () => {
 setResult(null);
 setAttemptId(null);
 setAnswers({});
 setFlagged({});
 setCurrentIdx(0);
 start.mutate();
 };

 const loadAttemptReview = async (aid) => {
 try {
 const { data } = await api.get(`/quiz-attempts/${aid}/`);
 setResult(data);
 setAttemptId(aid);
 setReviewIdx(0);
 } catch {
 toast.error('Could not load that attempt');
 }
 };

 const qs = questions.data || quiz.data?.questions || [];
 const answeredCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;
 const progress = qs.length ? Math.round((answeredCount / qs.length) * 100) : 0;

 // ---------- States ----------
 const showStart = !attemptId && !result && !isStaff;
 const showTake = !isStaff && attemptId && !result;
 const showResult = !!result;

 // ---------- Handlers ----------
 const setAnswer = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }));
 const toggleFlag = (qid) => setFlagged((f) => ({ ...f, [qid]: !f[qid] }));
 const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
 const goNext = () => setCurrentIdx((i) => Math.min(qs.length - 1, i + 1));

 return (
 <AppShell title={quiz.data?.title || 'Take quiz'} description={quiz.data?.description}>
 <div className="mb-4 flex items-center justify-between">
 <Link
 to="/quizzes"
 className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
 >
 <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Quizzes
 </Link>
 </div>

 {quiz.error && (
 <Alert variant="destructive" className="mb-4">
 <AlertDescription className="text-xs">Quiz not found</AlertDescription>
 </Alert>
 )}

 {quiz.data && (
 <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
 <StatusBadge status={quiz.data.status} />
 <span className="inline-flex items-center gap-1">
 <ListChecks className="h-3 w-3" aria-hidden /> {qs.length} question{qs.length === 1 ? '' : 's'}
 </span>
 {typeof quiz.data.best_score === 'number' && (
 <span className="inline-flex items-center gap-1 text-[var(--warn)]">
 <Trophy className="h-3 w-3" /> Best: <strong className="font-semibold">{quiz.data.best_score}%</strong>
 </span>
 )}
 {typeof quiz.data.attempt_count === 'number' && quiz.data.attempt_count > 0 && (
 <span>{quiz.data.attempt_count} attempt{quiz.data.attempt_count === 1 ? '' : 's'}</span>
 )}
 </div>
 )}

 {/* Past attempts */}
 {!isStaff && attempts.data && attempts.data.length > 0 && !attemptId && !result && (
 <div className="mb-6 rounded-xl border bg-card p-4">
 <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
 <Clock className="h-3 w-3" aria-hidden /> Past attempts
 </h3>
 <ul className="divide-y">
 {attempts.data.map((a) => (
 <li key={a.id} className="flex items-center justify-between gap-3 py-2">
 <div className="min-w-0">
 <p className="truncate text-sm font-medium">
 {a.submitted_at ? `Score: ${a.score ?? '—'}%` : 'In progress…'}
 </p>
 <p className="text-[11px] text-muted-foreground">
 Started {formatRelativeTime(a.started_at)}
 {a.submitted_at ? ` · submitted ${formatRelativeTime(a.submitted_at)}` : ''}
 </p>
 </div>
 {a.submitted_at ? (
 <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => loadAttemptReview(a.id)}>
 Review
 </Button>
 ) : (
 <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setAttemptId(a.id)}>
 Resume
 </Button>
 )}
 </li>
 ))}
 </ul>
 </div>
 )}

 {isStaff && !result && (
 <Alert className="mb-4">
 <AlertDescription className="text-xs">
 Staff accounts author quizzes but do not sit them. Manage questions from the Quiz manager.
 </AlertDescription>
 </Alert>
 )}

 {/* Start screen */}
 {showStart && (
 <div className="mx-auto max-w-xl view-enter">
 <div className="rounded-2xl border  from-indigo-50 to-violet-50 p-8 text-center dark: dark:">
 <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)]/80 text-primary dark:bg-white/10">
 <Sparkles className="h-7 w-7" aria-hidden />
 </span>
 <h2 className="mt-4 text-lg font-semibold">Ready to start?</h2>
 <p className="mt-1.5 text-sm text-muted-foreground">
 You'll get {qs.length} question{qs.length === 1 ? '' : 's'}. Take your time — answers are saved as you go and submitted when you click Finish.
 </p>
 <div className="mt-5 flex items-center justify-center gap-2">
 <Button
 type="button"
 size="sm"
 onClick={() => start.mutate()}
 disabled={start.isPending || qs.length === 0}
 className="h-9 gap-1.5  [var(--accent)] px-5 text-xs text-white hover:bg-[var(--accent-strong)]"
 >
 {start.isPending ? 'Starting…' : attempts.data?.length ? 'Start new attempt' : 'Start attempt'}
 <ChevronRight className="h-3.5 w-3.5" aria-hidden />
 </Button>
 <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/quizzes')} className="h-9 text-xs">
 Cancel
 </Button>
 </div>
 </div>
 </div>
 )}

 {/* Quiz in progress */}
 {showTake && (
 <QuizRunner
 qs={qs}
 currentIdx={currentIdx}
 answers={answers}
 flagged={flagged}
 progress={progress}
 answeredCount={answeredCount}
 loading={questions.isLoading}
 onPrev={goPrev}
 onNext={goNext}
 onJump={setCurrentIdx}
 onAnswer={setAnswer}
 onToggleFlag={toggleFlag}
 onSubmit={() => {
 if (answeredCount < qs.length && !window.confirm(`You've answered ${answeredCount} of ${qs.length}. Submit anyway?`)) return;
 submit.mutate();
 }}
 submitting={submit.isPending}
 />
 )}

 {/* Results */}
 {showResult && (
 <QuizResults
 result={result}
 qs={qs}
 reviewIdx={reviewIdx}
 setReviewIdx={setReviewIdx}
 retake={retake}
 canRetake={!isStaff}
 onBack={() => navigate('/quizzes')}
 />
 )}
 </AppShell>
 );
}

/* ---------------- Quiz runner (single-question-at-a-time) ---------------- */

function QuizRunner({
 qs, currentIdx, answers, flagged, progress, answeredCount, loading,
 onPrev, onNext, onJump, onAnswer, onToggleFlag, onSubmit, submitting,
}) {
 const q = qs[currentIdx];
 const options = q?.options || [];
 const isMultiChoice = options.length > 0;
 const currentAnswer = answers[q?.id];
 const isFlagged = !!flagged[q?.id];

 useEffect(() => {
 // Scroll to top when changing questions
 const el = document.getElementById('quiz-question-area');
 if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
 }, [currentIdx]);

 if (loading || !q) {
 return (
 <div className="mx-auto max-w-2xl">
 <div className="skeleton h-[240px] rounded-2xl" />
 </div>
 );
 }

 return (
 <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:flex-row">
 {/* Question */}
 <div id="quiz-question-area" className="min-w-0 flex-1 overflow-y-auto">
 {/* Progress bar */}
 <div className="mb-4">
 <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
 <span>Question {currentIdx + 1} of {qs.length}</span>
 <span>{answeredCount}/{qs.length} answered · {progress}%</span>
 </div>
 <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
 <div
 className="h-full rounded-full  [var(--accent)] transition-all duration-200"
 style={{ width: `${progress}%` }}
 role="progressbar"
 aria-valuenow={progress}
 aria-valuemin={0}
 aria-valuemax={100}
 />
 </div>
 </div>

 <div key={q.id} className="rounded-2xl border bg-card p-6 animate-slide-up">
 <div className="flex items-start justify-between gap-3">
 <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
 <HelpCircle className="h-3 w-3" aria-hidden />
 {q.question_type?.replace('_', ' ') || 'question'}
 </span>
 <button
 type="button"
 onClick={() => onToggleFlag(q.id)}
 className={cn(
 'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors',
 isFlagged
 ? 'border-amber-400/40 bg-[var(--warn-soft)] text-[var(--warn)]'
 : 'text-muted-foreground hover:bg-muted hover:text-foreground',
 )}
 aria-pressed={isFlagged}
 >
 <Flag className="h-3 w-3" aria-hidden />
 {isFlagged ? 'Flagged' : 'Flag'}
 </button>
 </div>

 <h2 className="mt-4 text-base font-semibold leading-snug sm:text-lg">
 {currentIdx + 1}. {q.question_text}
 </h2>

 <div className="mt-5 space-y-2">
 {isMultiChoice ? options.map((opt, i) => {
 const val = typeof opt === 'string' ? opt : opt.text || opt.id || String(opt);
 const selected = currentAnswer === i || currentAnswer === val;
 return (
 <button
 key={i}
 type="button"
 onClick={() => onAnswer(q.id, i)}
 className={cn(
 'group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
 selected
 ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/20'
 : 'border-border/70 bg-background hover:border-primary/30 hover:bg-accent/30',
 )}
 >
 <span
 className={cn(
 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors',
 selected
 ? 'border-primary bg-primary text-primary-foreground'
 : 'border-border bg-muted text-muted-foreground group-hover:border-primary/30',
 )}
 >
 {LETTERS[i]}
 </span>
 <span className="pt-0.5 text-sm leading-relaxed">{val}</span>
 </button>
 );
 }) : (
 <textarea
 value={currentAnswer || ''}
 onChange={(e) => onAnswer(q.id, e.target.value)}
 rows={4}
 placeholder="Type your answer…"
 className="w-full rounded-xl border bg-background p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
 />
 )}
 </div>
 </div>

 {/* Navigation */}
 <div className="mt-4 flex items-center justify-between gap-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={onPrev}
 disabled={currentIdx === 0}
 className="h-8 gap-1 px-3 text-xs"
 >
 <ChevronLeft className="h-3.5 w-3.5" /> Previous
 </Button>
 {currentIdx < qs.length - 1 ? (
 <Button
 type="button"
 size="sm"
 onClick={onNext}
 className="h-8 gap-1 px-3 text-xs"
 >
 Next <ChevronRight className="h-3.5 w-3.5" />
 </Button>
 ) : (
 <Button
 type="button"
 size="sm"
 onClick={onSubmit}
 disabled={submitting}
 className="h-8 gap-1.5  [var(--success)] px-4 text-xs text-white hover:opacity-90"
 >
 {submitting ? 'Submitting…' : <>Finish quiz <CheckCircle2 className="h-3.5 w-3.5" /></>}
 </Button>
 )}
 </div>
 </div>

 {/* Question navigator rail */}
 <aside className="w-full shrink-0 rounded-xl border bg-card p-4 lg:w-60">
 <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Questions</h3>
 <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
 {qs.map((qq, i) => {
 const answered = answers[qq.id] !== undefined && answers[qq.id] !== '';
 const isCur = i === currentIdx;
 const isFl = !!flagged[qq.id];
 return (
 <button
 key={qq.id}
 type="button"
 onClick={() => onJump(i)}
 className={cn(
 'relative flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition-all',
 isCur && 'ring-2 ring-primary/40',
 answered
 ? 'border-primary/40 bg-primary/10 text-primary'
 : 'border-border bg-background text-muted-foreground hover:bg-muted',
 isFl && !answered && 'border-amber-400/50 bg-[var(--warn)]/5 text-amber-600',
 )}
 title={`Question ${i + 1}${answered ? ' · answered' : ''}${isFl ? ' · flagged' : ''}`}
 >
 {i + 1}
 {isFl && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--warn)]" aria-hidden />}
 </button>
 );
 })}
 </div>
 <div className="mt-4 space-y-1.5 text-[10.5px] text-muted-foreground">
 <div className="flex items-center gap-1.5">
 <span className="h-2 w-2 rounded-sm bg-primary/60" /> Answered
 </div>
 <div className="flex items-center gap-1.5">
 <span className="h-2 w-2 rounded-sm bg-[var(--warn)]" /> Flagged
 </div>
 </div>
 <Button
 type="button"
 size="sm"
 variant="outline"
 onClick={onSubmit}
 disabled={submitting}
 className="mt-4 h-8 w-full gap-1 text-xs"
 >
 {submitting ? 'Submitting…' : 'Submit early'}
 </Button>
 </aside>
 </div>
 );
}

/* ---------------- Results view ---------------- */

function QuizResults({ result, _qs, reviewIdx, setReviewIdx, retake, canRetake, onBack }) {
 const score = typeof result.score === 'number' ? result.score : null;
 const passed = score !== null && score >= 50;
 const review = Array.isArray(result.review) ? result.review : [];

 const scoreColor = score === null
 ? 'text-muted-foreground'
 : score >= 80 ? 'text-[var(--success)] '
 : score >= 50 ? 'text-[var(--warn)]'
 : 'text-[var(--danger)]';

 const current = review[reviewIdx];

 return (
 <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
 {/* Summary hero */}
 <div className="overflow-hidden rounded-2xl border bg-[var(--surface)] p-6 sm:p-8">
 <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
 <span className={cn(
 'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl',
 passed ? 'bg-[var(--success)]/15 text-[var(--success)] ' : 'bg-[var(--danger)]/15 text-[var(--danger)]',
 )}>
 {passed
 ? <Trophy className="h-8 w-8" aria-hidden />
 : <XCircle className="h-8 w-8" aria-hidden />}
 </span>
 <div className="min-w-0 flex-1">
 <h2 className="text-lg font-semibold">{passed ? 'Nice work!' : 'Keep practicing!'}</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 {passed
 ? 'You passed this attempt. Review the questions below to reinforce what you learned.'
 : 'You did not quite pass this time. Review the feedback and try again.'}
 </p>
 <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Score</p>
 <p className={cn('text-3xl font-bold tabular-nums tracking-tight', scoreColor)}>
 {score ?? '—'}<span className="text-lg">%</span>
 </p>
 </div>
 {typeof result.correct_count === 'number' && typeof result.total_questions === 'number' && (
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Correct</p>
 <p className="text-xl font-semibold tabular-nums">
 {result.correct_count}<span className="text-sm text-muted-foreground">/{result.total_questions}</span>
 </p>
 </div>
 )}
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Submitted</p>
 <p className="text-sm">
 {result.submitted_at ? formatRelativeTime(result.submitted_at) : '—'}
 </p>
 </div>
 </div>
 <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
 {canRetake && (
 <Button size="sm" onClick={retake} className="h-8 gap-1.5  [var(--accent)] px-4 text-xs text-white hover:bg-[var(--accent-strong)]">
 <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retake quiz
 </Button>
 )}
 <Button type="button" variant="outline" size="sm" onClick={onBack} className="h-8 gap-1.5 px-4 text-xs">
 <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to quizzes
 </Button>
 </div>
 </div>
 </div>
 </div>

 {/* Review */}
 {review.length > 0 && current && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-semibold">Review your answers</h3>
 <div className="flex items-center gap-1 text-xs text-muted-foreground">
 {reviewIdx + 1} of {review.length}
 </div>
 </div>

 <div key={reviewIdx} className={cn(
 'rounded-2xl border-l-4 border bg-card p-5 animate-slide-up',
 current.is_correct ? 'border-l-[var(--success)]' : 'border-l-[var(--danger)]',
 )}>
 <div className="flex items-start gap-2.5">
 {current.is_correct ? (
 <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--success)]" aria-hidden />
 ) : (
 <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
 )}
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold leading-snug">
 {reviewIdx + 1}. {current.question_text}
 </p>
 </div>
 </div>

 <div className="mt-4 space-y-1.5">
 {Array.isArray(current.options) && current.options.length > 0 ? (
 current.options.map((opt, oi) => {
 const correctIdx = current.correct_answer?.index;
 const isUser = oi === (typeof current.user_answer === 'number' ? current.user_answer : null);
 const isCorrect = oi === correctIdx;
 return (
 <div
 key={oi}
 className={cn(
 'flex items-start gap-2.5 rounded-xl border px-3.5 py-2 text-sm',
 isCorrect && 'border-[var(--success)]/40 bg-[var(--success-soft)] text-[var(--success)] ',
 isUser && !isCorrect && 'border-red-500/40 bg-[var(--danger)]/8 text-red-700 dark:text-red-400',
 !isUser && !isCorrect && 'border-border/60 text-muted-foreground',
 )}
 >
 <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-black/5 text-[11px] font-semibold dark:bg-white/10">
 {LETTERS[oi]}
 </span>
 <span className="pt-0.5 leading-relaxed">
 {typeof opt === 'string' ? opt : opt.text || String(opt)}
 {isCorrect && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider">· correct</span>}
 {isUser && !isCorrect && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider">· your answer</span>}
 </span>
 </div>
 );
 })
 ) : (
 <div className="space-y-2 rounded-xl border bg-muted/20 p-3 text-sm">
 <p><span className="text-muted-foreground">Your answer:</span> {String(current.user_answer ?? '—')}</p>
 <p><span className="text-muted-foreground">Correct answer:</span> {String(
 (typeof current.correct_answer?.index === 'number' && Array.isArray(current.options)
 ? current.options[current.correct_answer.index]
 : current.correct_answer?.value) ?? '—',
 )}</p>
 </div>
 )}
 </div>

 {current.explanation && (
 <div className="mt-3.5 rounded-xl border bg-accent/40 p-3">
 <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Explanation</p>
 <p className="text-[12.5px] italic leading-relaxed text-muted-foreground">{current.explanation}</p>
 </div>
 )}
 </div>

 {/* Navigation */}
 <div className="flex items-center justify-between">
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={reviewIdx === 0}
 onClick={() => setReviewIdx((i) => Math.max(0, i - 1))}
 className="h-8 gap-1 px-3 text-xs"
 >
 <ChevronLeft className="h-3.5 w-3.5" /> Previous
 </Button>

 {/* Dots */}
 <div className="flex flex-wrap items-center justify-center gap-1">
 {review.map((r, i) => (
 <button
 key={i}
 type="button"
 onClick={() => setReviewIdx(i)}
 className={cn(
 'h-2 w-2 rounded-full transition-all',
 i === reviewIdx ? 'scale-125 bg-primary' : r.is_correct ? 'bg-[var(--success)]/60' : 'bg-[var(--danger)]/60',
 )}
 aria-label={`Go to question ${i + 1}`}
 />
 ))}
 </div>

 <Button
 type="button"
 size="sm"
 disabled={reviewIdx === review.length - 1}
 onClick={() => setReviewIdx((i) => Math.min(review.length - 1, i + 1))}
 className="h-8 gap-1 px-3 text-xs"
 >
 Next <ChevronRight className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>
 )}
 </div>
 );
}

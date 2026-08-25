import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  Bookmark,
  Bot,
  Check,
  ClipboardList,
  FileText,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Your materials, understood",
    text: "Upload PDFs, slides, and notes. AcademiAI extracts, indexes, and makes them searchable — automatically.",
  },
  {
    icon: Bot,
    title: "Grounded AI answers",
    text: "Ask questions in plain language. Every answer cites the exact source passages from materials you're allowed to see.",
  },
  {
    icon: ClipboardList,
    title: "Instant practice quizzes",
    text: "Generate multiple-choice quizzes from your own course materials and check your understanding in minutes.",
  },
  {
    icon: Sparkles,
    title: "One-tap summaries",
    text: "Reference any material and get a faithful, structured summary — overview, key points, and key terms.",
  },
  {
    icon: Bookmark,
    title: "Personal learning space",
    text: "Bookmarks, notes, and per-topic progress stay with you across every course and semester.",
  },
  {
    icon: ShieldCheck,
    title: "Institution-grade isolation",
    text: "Strict tenant boundaries and database-level security keep each institution's materials fully separate.",
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight">AcademiAI</span>
          </Link>
          <nav className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Open workspace <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(700px circle at 15% 0%, oklch(0.42 0.15 272 / 0.12), transparent), radial-gradient(600px circle at 85% 20%, oklch(0.55 0.13 200 / 0.10), transparent)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Multi-tenant academic AI platform
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl">
            Turn your course materials into a{" "}
            <span className="text-primary">study partner</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            AcademiAI indexes your institution's lecture notes, slides, and
            documents — then answers your questions with cited, grounded
            responses, generates practice quizzes, and summarizes readings in
            seconds.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={isAuthenticated ? "/dashboard" : "/signup"}
              className="inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-ring"
            >
              {isAuthenticated ? "Go to workspace" : "Create free account"}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-11 items-center rounded-xl border bg-card px-6 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              Sign in
            </Link>
          </div>
          <ul className="mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {["Cited answers only", "Tenant-isolated", "Async AI pipelines"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need to study smarter
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
            Built for students, lecturers, and administrators — one workspace
            for materials, AI assistance, and assessment.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="group rounded-xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Up and running in three steps
          </h2>
          <ol className="mt-12 space-y-8">
            {[
              {
                n: "1",
                title: "Join your institution",
                text: "Sign up with your institution's slug and verify your email.",
              },
              {
                n: "2",
                title: "Upload your materials",
                text: "Drop in PDFs, slides, or notes. Processing, chunking, and indexing happen automatically.",
              },
              {
                n: "3",
                title: "Ask, summarize, practice",
                text: "Chat with grounded answers, generate quizzes, and track your progress as you learn.",
              },
            ].map(({ n, title, text }) => (
              <li key={n} className="flex gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                  {n}
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-sidebar py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Ready to study with an AI that cites its sources?
          </h2>
          <Link
            to={isAuthenticated ? "/dashboard" : "/signup"}
            className="mt-7 inline-flex h-11 items-center rounded-xl bg-primary px-7 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {isAuthenticated ? "Open your workspace" : "Get started — it's quick"}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="border-t py-8">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AcademiAI · Multi-tenant academic AI platform
        </p>
      </footer>
    </div>
  );
}

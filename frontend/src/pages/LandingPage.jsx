import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/shared/ThemeToggle";
import BrandMark from "@/components/shared/BrandMark";
import SkeletonRows from "@/components/shared/SkeletonRows";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Bookmark,
  Bot,
  Building2,
  Check,
  ClipboardList,
  FileText,
  GraduationCap,
  Landmark,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const CORE_FEATURES = [
  {
    icon: Bot,
    title: "Grounded AI chat",
    text: "Ask questions about your university courses, get answers with citations from authorized materials. No hallucinations.",
    chip: "Citations included",
  },
  {
    icon: ClipboardList,
    title: "Auto-generated quizzes",
    text: "Auto-generated quizzes from your course resources. Test understanding, track progress, ace exams.",
    chip: "AI generated",
  },
  {
    icon: FileText,
    title: "Smart summaries",
    text: "Concise summaries of course materials. Save hours, retain more, focus on what matters.",
    chip: "One tap",
  },
];

const HOW_STEPS = [
  {
    n: "01",
    title: "Your university gets its own tenant",
    text: "Each university (tenant) gets its own isolated environment with faculties, departments, courses, roles and permissions.",
  },
  {
    n: "02",
    title: "Lecturers upload authorized materials",
    text: "Lecture notes, PDFs and slides are chunked, embedded and understood by the AI — within that tenant only.",
  },
  {
    n: "03",
    title: "Students learn with cited answers",
    text: "Chat, generate quizzes, and get summaries — all grounded in your own university's materials, with citations you can open.",
  },
];

const EXTRAS = [
  {
    icon: Smartphone,
    tag: "Coming soon",
    title: "AcademiAI mobile",
    text: "Study on the go, offline access, push notifications for quizzes and updates.",
  },
  {
    icon: UsersRound,
    tag: "Coming soon",
    title: "Collaborative study boards",
    text: "Collaborate with classmates across your university — shared boards with grounded context.",
  },
];

const FOOTER_PRODUCT = [
  { label: "For students", href: "#features" },
  { label: "For lecturers", href: "#how" },
  { label: "For admins", href: "#how" },
  { label: "Institutions directory", href: "#institutions" },
];
const FOOTER_PROJECT = [
  { label: "Final Year Project 2025/2026", href: "#case-study" },
  { label: "ATBU case study", href: "#case-study" },
  { label: "Multi-tenant architecture", href: "#how" },
];

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */


const pillPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-ring";
const pillGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-card px-7 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

/* ------------------------------------------------------------------ */
/* Institutions directory (visitor-facing)                             */
/* ------------------------------------------------------------------ */

function InstitutionDirectory() {
  const [search, setSearch] = useState("");
  const q = search.trim();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-directory", q],
    queryFn: async () => {
      const { data } = await api.get("/tenants/directory/", {
        params: q ? { search: q } : {},
      });
      return data.results || [];
    },
    staleTime: 60_000,
  });

  const institutions = data || [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for your university…"
          aria-label="Search institutions"
          className="h-12 rounded-full pl-11 text-sm shadow-sm"
        />
      </div>

      <div className="mt-5" role="list" aria-label="Institutions">
        {isLoading ? (
          <SkeletonRows rows={2} />
        ) : institutions.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-8 text-center">
            <Building2 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-medium">
              {q ? `No institutions match “${q}”` : "No institutions yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Universities are onboarded by the platform team — yours could be next.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {institutions.map((t) => (
              <li key={t.id} role="listitem">
                <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary">
                    {(t.name?.[0] || "?").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={t.name}>
                      {t.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">/{t.slug}</p>
                  </div>
                  <Link
                    to="/signup"
                    className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    Join
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen antialiased">
      {/* ---------------------------------------------------------- Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-ring rounded-md">
            <BrandMark />
            <span className="text-lg font-bold tracking-tight">AcademiAI</span>
            <span className="ml-1 hidden rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:inline-block">
              Multi-tenant · FYP
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Page sections">
            {[
              ["#features", "Features"],
              ["#how", "How it works"],
              ["#institutions", "Universities"],
              ["#case-study", "Case study"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex h-9 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                Open workspace <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex h-9 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 blur-3xl"
          style={{
            background:
              "radial-gradient(600px circle at 12% 10%, oklch(0.55 0.2 295 / 0.16), transparent 55%), radial-gradient(500px circle at 88% 30%, oklch(0.6 0.15 255 / 0.14), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-24 lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              Multi-tenant · Built as a Final Year Project
            </span>
            <h1 className="mt-6 max-w-[16ch] text-4xl font-extrabold leading-[0.98] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              AI-powered academic assistance{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(to bottom right, oklch(0.55 0.25 293), oklch(0.55 0.23 265), oklch(0.58 0.21 250))",
                }}
              >
                for every university
              </span>
            </h1>
            <p className="mt-6 max-w-[58ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
              AcademiAI gives every university its own AI assistant. Students
              access, understand, and excel with their course materials through
              intelligent chat, personalized quizzes, and smart summaries — all
              grounded in authorized academic resources. Currently implemented
              as a case study at Abubakar Tafawa Balewa University, Bauchi.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={isAuthenticated ? "/dashboard" : "/signup"}
                className={pillPrimary}
              >
                {isAuthenticated ? "Open workspace" : "Create account"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#institutions" className={pillGhost}>
                Find your university
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" aria-hidden /> Live implementation
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure &amp; tenant-isolated
              </span>
              <span className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" aria-hidden /> Scales to any faculty
              </span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative view-enter">
            <div className="overflow-hidden rounded-[2rem] border bg-card shadow-2xl">
              <img
                src="/images/holographic_ai_library_collaboration.webp"
                alt="Students collaborating with an AI assistant inside a digital library"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
                <GraduationCap className="h-3.5 w-3.5 text-primary" aria-hidden />
                One workspace per university — students, lecturers, admins
              </div>
            </div>
            <div className="absolute -bottom-6 -left-4 hidden rounded-2xl border bg-card p-4 shadow-xl md:block">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Answers grounded in
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                Your university&apos;s materials only
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Features */}
      <section id="features" className="border-y bg-muted/40 py-20 scroll-mt-16 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="max-w-[18ch] text-3xl font-bold leading-[0.98] tracking-tight sm:text-4xl">
              Your complete academic assistant
            </h2>
            <p className="max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
              Designed for universities to provide grounded AI assistance to
              their students — every answer traced to authorized course
              materials from your university&apos;s tenant.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {CORE_FEATURES.map(({ icon: Icon, title, text, chip }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, oklch(0.55 0.25 293), oklch(0.55 0.23 265), oklch(0.58 0.21 220))",
                  }}
                  aria-hidden
                />
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {chip}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              { icon: Bookmark, t: "Bookmarks & notes", d: "Personal learning space across every course." },
              { icon: ShieldCheck, t: "Tenant isolation", d: "Database-level security keeps each university separate." },
              { icon: GraduationCap, t: "Progress tracking", d: "Per-concept mastery as you move through the curriculum." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex items-start gap-3 rounded-2xl border bg-card/60 p-5">
                <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-medium">{t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------- How it works */}
      <section id="how" className="py-20 scroll-mt-16 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="max-w-[20ch] text-3xl font-bold leading-[0.98] tracking-tight sm:text-4xl">
              How AcademiAI works for your university
            </h2>
            <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
              A multi-tenant architecture where each university gets its own
              isolated, secure environment — scalable to any faculty or
              department.
            </p>
          </div>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <ol className="space-y-8">
              {HOW_STEPS.map(({ n, title, text }) => (
                <li key={n} className="flex gap-5">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-md"
                    style={{
                      backgroundImage:
                        "linear-gradient(to bottom right, oklch(0.55 0.25 293), oklch(0.55 0.22 260))",
                    }}
                  >
                    {n}
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="relative overflow-hidden rounded-[2rem] border shadow-xl">
              <img
                src="/images/abuja_campus_sunset.webp"
                alt="University campus at sunset"
                loading="lazy"
                className="aspect-[4/3] h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden />
              <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-zinc-900 backdrop-blur">
                <Landmark className="h-3.5 w-3.5" aria-hidden />
                Case study: ATBU campus · Faculty of Computing
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------- Knowledge showcase */}
      <section className="border-t bg-muted/40 py-20 lg:py-24">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] border shadow-xl view-enter">
            <img
              src="/images/ai_knowledge_graph_visualization.webp"
              alt="Knowledge graph connecting course concepts"
              loading="lazy"
              className="aspect-[4/3] w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-primary">
              <Bot className="h-3.5 w-3.5" aria-hidden /> Under the hood
            </span>
            <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              A knowledge graph behind every answer
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Uploaded documents are chunked, embedded, and linked into a
              concept map of your curriculum. When you ask a question,
              AcademiAI retrieves the exact passages and cites them — never a
              hallucinated reference.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Citations point to real passages you can open",
                "Concept-level progress tracking as you study",
                "Visibility scopes keep materials within your institution",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* --------------------------------------------- Institutions */}
      <section id="institutions" className="py-20 scroll-mt-16 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
            <h2 className="max-w-[18ch] text-3xl font-bold leading-[0.98] tracking-tight sm:text-4xl">
              Find your university
            </h2>
            <p className="max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
              Each university gets its own private workspace. Browse the
              directory and join yours in under a minute.
            </p>
          </div>
          <InstitutionDirectory />
        </div>
      </section>

      {/* --------------------------------------------------- Coming soon */}
      <section className="border-y bg-muted/40 py-16">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            On the roadmap
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {EXTRAS.map(({ icon: Icon, tag, title, text }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-2xl border bg-card p-6 opacity-90 transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {title}
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tag}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Case study */}
      <section id="case-study" className="py-20 scroll-mt-16 lg:py-24">
        <div className="mx-auto max-w-[900px] px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <GraduationCap className="h-3.5 w-3.5 text-primary" aria-hidden />
            Final Year Project · Department of Computer Science
          </span>
          <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Case study: Abubakar Tafawa Balewa University, Bauchi
          </h2>
          <p className="mx-auto mt-5 max-w-[64ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
            AcademiAI is being developed as a Final Year Project for the
            Department of Computer Science, Faculty of Computing, ATBU Bauchi.
            The faculty serves as the initial implementation example,
            demonstrating how any university can adopt AcademiAI as a
            multi-tenant solution — starting with Computer Science courses,
            with architecture ready for any faculty and university.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="relative isolate overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to bottom right, oklch(0.52 0.26 293), oklch(0.52 0.24 275), oklch(0.55 0.22 250))",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 50%)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <h2 className="text-3xl font-bold leading-[0.98] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Join the future of academic learning
          </h2>
          <p className="mx-auto mt-4 max-w-[60ch] text-[15px] leading-relaxed text-white/80 sm:text-base">
            Multi-tenant, secure, grounded. Built as an ATBU Faculty of
            Computing case study — open for collaboration with any university.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={isAuthenticated ? "/dashboard" : "/signup"}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-zinc-900 shadow-xl transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {isAuthenticated ? "Open your workspace" : "Get started free"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="#institutions"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 text-[15px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-ring"
            >
              Browse universities
            </a>
          </div>
          <p className="mt-8 text-xs text-white/70">
            Multi-tenant · For any university · Open for collaboration
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- Footer */}
      <footer className="py-14">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark size="h-8 w-8" />
              <span className="text-base font-bold tracking-tight">AcademiAI</span>
            </div>
            <p className="mt-3 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
              AI-powered academic assistance for every university. Multi-tenant
              platform · Final Year Project · Computer Science · ATBU Bauchi
              (case study).
            </p>
          </div>
          <nav aria-label="Product">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {FOOTER_PRODUCT.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Project">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Project
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {FOOTER_PROJECT.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mx-auto mt-12 max-w-[1280px] border-t px-4 pt-6 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} AcademiAI — built for defense · designed for scale · open for collaboration
          </p>
        </div>
      </footer>
    </div>
  );
}

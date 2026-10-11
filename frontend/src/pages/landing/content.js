// Shared landing content — the single source of truth for all three
// /landing-lab variants. Copy lives here so every variant presents identical
// facts and the only difference between variants is presentation.
//
// NOTE (roadmap copy): the ROADMAP items below are plausible placeholders for
// capabilities that are not yet shipped. They are presented as "in
// development" and must not be described as available. Replace the text as
// real status becomes known.
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BookOpenCheck,
  Bot,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Globe,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Lock,
  Mail,
  Megaphone,
  MessagesSquare,
  PenTool,
  Radio,
  Rss,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';

export const BRAND = {
  name: 'AcademiAI',
  tagline: 'Multi-tenant · Grounded · Institution-first',
  homeLabel: 'AcademiAI home',
};

export const NAV_LINKS = [
  { label: 'Product', href: '#solution' },
  { label: 'Security', href: '#security' },
  { label: 'Roles', href: '#roles' },
  { label: 'Roadmap', href: '#roadmap' },
  { label: 'How it works', href: '#how' },
];

export const HERO = {
  eyebrow: 'Multi-tenant · Grounded · Institution-first',
  headlineLead: 'Knowledge, ',
  headlineAccent: 'cited.',
  headlineTail: ' Not imagined.',
  lede: 'AcademiAI gives every university its own isolated AI workspace — grounded chat, quizzes and cohort insight drawn from the institution\u2019s own authorised materials, with every claim traced back to a page.',
  primaryCta: { label: 'Request your workspace', to: '/request-institution' },
  secondaryCta: { label: 'See grounding in action', href: '#grounding' },
  sessionCta: { label: 'Open workspace', to: '/dashboard' },
  proof: [
    { icon: ShieldCheck, label: 'RLS-isolated tenants' },
    { icon: BadgeCheck, label: 'Every answer cited' },
    { icon: Lock, label: 'Audited reads' },
  ],
};

export const CHAT = {
  bar: 'GROUNDED CHAT',
  status: 'ONLINE',
  badge: 'RLS-scoped',
  question: 'Why does this algorithm run in O(n log n)?',
  answer:
    'The divide-and-conquer steps split the input into logarithmic levels, and each level processes all n items once — together that is n log n work.',
  citation: { index: '[1]', doc: 'Algorithms-lecture-03.pdf', page: 'p.18', score: 'sim 0.94' },
  meta: ['retrieved 4 chunks', 'reranked', 'verified'],
  placeholder: 'Ask about the Thermodynamics Syllabus 2024…',
  sources: [
    ['Algorithms-lecture-03.pdf', '0.94', 'Page 42 · §3.2 · Verified'],
    ['Thermodynamics Syllabus 2024.pdf', '0.91', 'Page 7 · §1.1 · Verified'],
    ['DS-drive-notes-v2.pdf', '0.89', 'Page 12 · §4.0 · Verified'],
    ['Complexity-theory-notes.docx', '0.86', 'Page 3 · §2.4 · Verified'],
  ],
};

export const PROBLEM = {
  eyebrow: 'The problem',
  heading: 'Materials are fragmented. Answers shouldn\u2019t be.',
  intro:
    'Lecturers prepare relentlessly. Students still end up asking a generic chatbot that guesses instead of citing. The result is time lost and answers without receipts.',
  items: [
    {
      icon: FileText,
      title: 'Materials live in a dozen drives',
      text: 'Slide decks, notes, past papers and PDFs sit split across departments and folders — there is no single place to ask.',
    },
    {
      icon: Bot,
      title: 'Generic answers, zero receipts',
      text: 'General-purpose chatbots answer plausibly but never point back to your university\u2019s actual materials.',
    },
    {
      icon: TrendingUp,
      title: 'Confusion hides until the exam',
      text: 'You only discover what a cohort actually missed long after the deadline has passed.',
    },
  ],
};

export const PLATFORM = {
  id: 'solution',
  eyebrow: 'The platform',
  heading: 'One isolated workspace per institution.',
  intro:
    'Every university runs in its own tenant — with courses, roles, materials and an AI assistant shaped around how each working role actually learns and teaches.',
  items: [
    {
      icon: Bot,
      title: 'Grounded chat',
      text: 'Every answer retrieves from authorised materials and cites the exact page and passage it came from.',
    },
    {
      icon: UserRound,
      title: 'Role agents',
      text: 'A dedicated agent per working role — student study partner, lecturer co-pilot, admin operator.',
    },
    {
      icon: ListChecks,
      title: 'Study planner',
      text: 'A vague goal becomes milestones and dated tasks you can actually follow.',
    },
    {
      icon: Calendar,
      title: 'Layered calendar',
      text: 'Lectures, exams, office hours and your study plan in one layered view.',
    },
    {
      icon: BookOpenCheck,
      title: 'Quizzes from your slides',
      text: 'Drafted by the AI, reviewed by lecturers, then published — attempts feed mastery records.',
    },
    {
      icon: TrendingUp,
      title: 'Cohort signals',
      text: 'Concept confusion ranked by quiz results and real student questions — while the term can still be steered.',
    },
  ],
};

export const HOW = {
  id: 'how',
  eyebrow: 'How it works',
  heading: 'From upload to cited answer in three steps.',
  intro:
    'No data-science team required — the pipeline parses, isolates and serves as soon as material is in.',
  steps: [
    {
      num: '01',
      title: 'Upload & parse',
      text: 'Lecturers bring in notes, slides and PDFs. The pipeline chunks and embeds them asynchronously.',
    },
    {
      num: '02',
      title: 'Index & isolate',
      text: 'Vectors land in a per-tenant index. Row-level security keeps every institution private.',
    },
    {
      num: '03',
      title: 'Cite & answer',
      text: 'Questions retrieve, rerank and answer — with the page, passage and score openable behind every claim.',
    },
  ],
};

export const ISOLATION = {
  id: 'security',
  eyebrow: 'Security',
  heading: 'Hard isolation. Not soft promises.',
  intro:
    'Isolation is enforced at the database layer before your application code ever runs. One institution\u2019s materials can never surface in another\u2019s answers.',
  points: [
    'Row-level security enforced at the database layer',
    'Per-tenant pgvector HNSW index',
    'Region-pinned storage and tenant-scoped app queries',
    'Every read leaves an audit trail',
  ],
  tenants: [
    {
      name: 'TENANT_A',
      domain: 'uniben.edu.ng',
      tag: 'RLS enforced',
      active: true,
      meta: ['pgvector · hnsw', 'region eu-west-1', 'tenant_id t_9f1c'],
    },
    {
      name: 'TENANT_B',
      domain: 'parakou.bj',
      tag: 'RLS enforced',
      active: false,
      meta: ['pgvector · hnsw', 'region eu-west-1'],
    },
    {
      name: 'TENANT_C',
      domain: 'eneam.bj',
      tag: 'RLS enforced',
      active: false,
      meta: ['pgvector · hnsw', 'region eu-west-1'],
    },
  ],
};

export const GROUNDING = {
  id: 'grounding',
  eyebrow: 'Grounding',
  heading: 'See the grounding in action.',
  intro:
    'Ask in plain language. The answer retrieves only what your institution authorised, reranks it, and pins every claim to a source you can open.',
};

export const ROLES = {
  id: 'roles',
  eyebrow: 'Roles',
  heading: 'One agent per working role.',
  intro:
    'Not one chatbot for everyone — a dedicated assistant shaped around how students, lecturers and administrators actually work, all inside a single isolated workspace.',
  items: [
    {
      icon: GraduationCap,
      label: 'Student · Study partner',
      title: 'Understand more, nail every deadline.',
      text: 'Explains concepts at your level, diagnoses the weak points behind wrong answers, and turns a vague goal into a plan — always citing the material you are authorised to see.',
    },
    {
      icon: BookOpen,
      label: 'Lecturer · Course co-pilot',
      title: 'Prep, teach, know your class.',
      text: 'Structures lectures and office hours, orders deadlines, flags conflicts, and answers \u201cwho needs attention\u201d — grounded in quiz results and what students actually ask.',
    },
    {
      icon: ShieldCheck,
      label: 'Admin · Institution operator',
      title: 'Run the institution smoothly.',
      text: 'Instrument-wide views of analytics, calendars, schedules, users and logs — with a single actionable take on the day.',
    },
  ],
};

export const SIGNALS = {
  eyebrow: 'Cohort signals',
  heading: 'Confusion surfaces early.',
  intro:
    'Ranked, per-concept signals reach the lecturer while the term can still be steered — not after marks come out.',
  items: [
    {
      icon: Rss,
      title: 'Concept confusion',
      text: 'Ranked by quiz results and the questions students actually put to the tutor.',
      bars: [2, 3, 4, 6, 8, 7, 9, 10],
    },
    {
      icon: FileText,
      title: 'Coverage gaps',
      text: 'Resources that are rarely accessed — or missing the context a question keeps needing.',
      bars: [8, 6, 5, 4, 4, 2, 1, 1],
    },
    {
      icon: Megaphone,
      title: 'Early warning',
      text: 'Signals reach the lecturer while the term can still be steered, not after marks.',
      bars: [1, 1, 2, 4, 5, 7, 9, 10],
    },
  ],
};

/* Verifiable product principles (mirrors PRODUCT.md) — never fabricated
   quotes; unattributable claims don't ship. */
export const COMMITMENTS = {
  eyebrow: 'Commitments',
  heading: 'Three promises we can prove.',
  items: [
    {
      num: '01',
      title: 'Grounded truth over fluency',
      text: 'If retrieval cannot support an answer, the assistant says so. No invented content — every claim traces to a document, page and score you can open.',
    },
    {
      num: '02',
      title: 'Hard isolation',
      text: 'Row-level security at the database layer seals each institution\u2019s materials, index and audit trail inside its own tenant.',
    },
    {
      num: '03',
      title: 'Full audit',
      text: 'Every significant action is logged and reviewable. Trust here is verified, not assumed.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Roadmap / coming soon — PLACEHOLDER COPY. Present as in-development only.
// ---------------------------------------------------------------------------
export const ROADMAP = {
  id: 'roadmap',
  eyebrow: 'On the roadmap',
  heading: 'What\u2019s coming next.',
  intro:
    'In active development. Each one arrives inside the same isolated workspace — no migration, no new logins.',
  items: [
    {
      icon: Globe,
      status: 'In development',
      tag: 'Subdomains',
      title: 'Your own institution address',
      text: 'Every institution gets a branded home — your slug becomes a live address, e.g. https://atbu.academiai.com, so students land exactly where they belong.',
    },
    {
      icon: Mail,
      status: 'In development',
      tag: 'Domain email',
      title: 'Verified institution sign-up',
      text: 'Students join with their school email on the institution\u2019s own domain, confirmed automatically — no stray accounts, no mixing across universities.',
    },
    {
      icon: MessagesSquare,
      status: 'Next up',
      tag: 'Students',
      title: 'Personal chat',
      text: 'Private, direct messaging between students who share a department, institution, faculty, or a course they are both enrolled in.',
    },
    {
      icon: Radio,
      status: 'Next up',
      tag: 'Lecturers & admins',
      title: 'Community channels',
      text: 'Topic channels run by lecturers and admins; students subscribe to what they need. Every course ships with a default community, and the assigned course lecturer is its admin.',
    },
    {
      icon: PenTool,
      status: 'In design',
      tag: 'Shared canvas',
      title: 'Whiteboard',
      text: 'A shared canvas to work through a problem live — sketch, annotate and solve alongside the AI and your peers.',
    },
    {
      icon: LayoutGrid,
      status: 'In design',
      tag: 'Departments',
      title: 'Department workspaces',
      text: 'A dedicated space per department for its courses, staff and resources, run by the department admin.',
    },
    // Roles that do not exist in the product yet — shown here, never in the
    // Roles section until they ship.
    {
      icon: Users,
      status: 'Next up',
      tag: 'New role',
      title: 'Department admin',
      text: 'A department-scoped admin role to own courses, lecturer assignments and resources — enrolment, structure and access for one department at a time.',
    },
    {
      icon: Building2,
      status: 'Next up',
      tag: 'New role',
      title: 'Faculty admin',
      text: 'A faculty-wide admin role to oversee departments, programmes and reporting, still sealed inside the same isolated, audited workspace.',
    },
  ],
};

export const GET_STARTED = {
  id: 'institutions',
  eyebrow: 'Get started',
  heading: 'Turn your university into a workspace.',
  intro:
    'Requests are reviewed daily and provisioned in under 48 hours — with a private tenant, academic hierarchy, roles and an AI grounded in materials your lecturers upload.',
  form: {
    emailLabel: 'Work email',
    emailPlaceholder: 'you@university.edu.ng',
    institutionLabel: 'Institution name',
    institutionPlaceholder: 'e.g. University of Lagos',
    submitLabel: 'Request workspace',
    note: 'Setup is free for early adopters · no card required · your data stays in-region.',
  },
  directory: {
    heading: 'Find your university',
    intro:
      'Already running on AcademiAI? Search the live directory and join your institution in under a minute.',
    searchPlaceholder: 'Search your university',
    joinLabel: 'Join',
    empty: 'No active institutions are listed yet.',
    emptySearch: 'No active institution matches that search.',
    loading: 'Loading the live institution directory...',
    error: 'The institution directory is unavailable right now.',
    missingCta: 'Don\u2019t see yours? Request it',
  },
};

export const FAQ = {
  id: 'faq',
  eyebrow: 'FAQ',
  heading: 'Questions, answered straight.',
  items: [
    {
      q: 'Where do answers actually come from?',
      a: 'Every answer is grounded in your institution\u2019s own authorised resources — slides, notes, and PDFs uploaded by lecturers. Retrieval returns exact passages, and each claim carries the document, page, and score you can open and check.',
    },
    {
      q: 'Is our content kept private between universities?',
      a: 'Yes. Each institution runs in its own isolated tenant, enforced at the database layer with row-level security and then at the application layer on every query. Content from one university can never surface in another tenant\u2019s answers.',
    },
    {
      q: 'Who gets to see and use what?',
      a: 'Students, lecturers, administrators, and department or faculty admins each get a role-shaped workspace with a dedicated agent. Visibility scopes keep materials inside your institution, and administrators control access, announcements, and the audit trail.',
    },
    {
      q: 'Does setting this up need our IT team?',
      a: 'No on-premises infrastructure. Request your institution and, once approved, you receive an auto-provisioned workspace with its own academic hierarchy, roles, and access rules — ready to add material to.',
    },
    {
      q: 'Can we bring in our existing timetable?',
      a: 'Yes. Upload it as CSV or XLSX, review the parsed matrix in a preview step, then commit — lectures, exams, and office hours land on the calendar. Any view can also be exported to ICS.',
    },
    {
      q: 'What does it cost to start?',
      a: 'Free to start for students — create an account and join your university\u2019s workspace. Institutions are provisioned on request, and plan tiers are being finalised, so ask and we\u2019ll confirm the details.',
    },
  ],
};

export const FOOTER = {
  links: [
    { label: 'Security', href: '#security' },
    { label: 'Institutions', href: '#institutions' },
    { label: 'Roadmap', href: '#roadmap' },
    { label: 'FAQ', href: '#faq' },
  ],
};

// Re-export the icon set variants commonly need so they don't each guess.
export {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Lock,
  Search,
  ShieldCheck,
};

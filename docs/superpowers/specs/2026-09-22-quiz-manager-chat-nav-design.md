# Quiz Manager, Chat Send Fix, Role Suggestions, Navigation, Resources Library — Design

Date: 2026-09-22
Status: reviewed with you — G3 split out as Part H, spec committed; ready for the
implementation plans
Origin: session brief — "improve the quiz manager… remove logic for generating
quizzes automatically… fix chat not working… tenant admin should see different
suggested text… sidebar should have one source of truth for quiz… upload link
unclear… check for other bugs."

## Classification

| Part | Path | Rationale |
|---|---|---|
| A. Chat send fix | Bounded | One handler, two guards. Root cause established with code + data evidence. |
| B. Role-aware suggestions | Bounded | Constant becomes a role-keyed lookup. |
| C. Quiz Manager | **Architectural** | Migration, a changed generation contract, and a scoring rule change consumed by review/analytics. |
| D. Navigation | **Architectural** | Replaces the data model four components read; enforces a new invariant. |
| E. Incidental fixes | Bounded | Independent defects found during research. |
| F. Local RLS roles | Environment | Not code. Corrects live-volume drift left by the `academiai_app` → `academiai` role rename. |
| G. Resources library | **Architectural** | Changes how the list is fetched (server pagination), adds a filter the API does not expose yet, and splits a 645-line page. |
| H. Moderation workflow | **Architectural** | Gives a complete, currently unreachable backend lifecycle its first UI: report affordance, queue page, route, nav item. Split out of G by your decision; deferred, not dropped. |

## Assumptions and decisions

Items 1-2 are recommendations written into the design so the spec is
unambiguous; each is one line to reverse. Items 3, 6 and 7 are your confirmed
decisions.

1. **Multi-select scoring is all-or-nothing.** No partial credit. Partial credit
   is a grading policy, not a technical default.
2. **No `points` field, no `Quiz`↔`Resource` M2M.** Neither was requested;
   generation-time resource selection is transient input, and `QuizQuestion.source_chunk`
   already records which chunk a generated question actually came from.
3. **Students can add material — confirmed by you on 2026-09-22, so this is no
   longer an assumption.** `/resources/upload` stays `EVERYONE` and is declared
   for all roles in `NAV_SECTIONS`. The backend already encodes this intent:
   students may upload with `course` visibility against offerings they are
   enrolled in, and the serializer comment says plainly that a student's "upload
   surface is the Resources page" (`resources/serializers.py:25-26`, `:81`). The
   reason this had to be an explicit decision: a student's only two paths there
   today are the *un-gated* ⌘K entries at `CommandPalette.jsx:111` and `:211`,
   and once the palette consumes `visibleNav` those become role-filtered — so
   declaring the route for `EVERYONE` is what keeps a working feature working.
4. **Difficulty uses per-level counts; type uses a subset selection.** A lecturer
   tunes difficulty deliberately but usually wants "any of these formats", and a
   type × difficulty matrix is UI nobody asked for.
5. **Students keep one-click generation with no difficulty/type picker.** The
   brief said generation should be "configured for staff only"; read literally
   that would remove the student button entirely, which deletes working
   behaviour. Part C resolves the tension: configuration is staff-only, the
   student action stays one click and gains resource choice only.
6. **Resources page: filter by uploader *role*, filter by course, do not group
   by course — and all roles get both filters.** Confirmed on 2026-09-22; Part G.
7. **The moderation workflow is split out of Part G into Part H, and Part H is
   planned after G ships rather than folded into it.** Confirmed on 2026-09-22.
   Rationale recorded in H: G is a library-UX fix you asked for; H is a safety
   workflow you did not, and mixing them makes the smaller change wait for the
   larger one. Nothing regresses in the meantime — the moderation code is
   unreachable today, not broken.

---

## A. Chat send fix

### Root cause (verified, not inferred)

`ChatPage.jsx:1345-1349` — the `Enter` handler calls `send()` guarded only by
`!loading`:

```js
onKeyDown={(e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!loading) send();
  }
}}
```

The submit *button* at `:1367` does disable on `uploadingFiles`; the keyboard
path does not. `send()` at `:862` checks only `loading`.

While a file is uploading, `handleFilesSelected` has already inserted a
placeholder at `:816-824` whose id is **not** a UUID:

```js
id: `upload-${Date.now()}-${Math.random()}`,
```

`send()` at `:869` keeps it — `filter(Boolean)` drops falsy values, not local
placeholder strings:

```js
const resourceIds = attachedResources.map((r) => r.id).filter(Boolean);
```

That reaches `ChatMessageCreateSerializer.resource_ids`, a
`ListField(child=UUIDField())` (`chat/serializers.py:104-106`), whose
`is_valid(raise_exception=True)` at `chat/views.py:338` returns **HTTP 400** —
*before* `append_user_message` at `:356`. `createSSEStream` throws
`HTTP 400: …` (`api.js:148-151`) and `onError` surfaces it at `ChatPage.jsx:914`.

Database evidence, same day: two `New chat` sessions containing **zero**
messages (`ddea986b…` 13:14, `ffc83f57…` 12:58). `ensureSession()` is only ever
called from inside `send`, so a send was attempted and died upstream of
persistence. The `e2e` session that succeeded holds both a user row and an
assistant row. Ruled out with evidence: URL match, field-name match, auth
headers, `tenant_scope` in the generator, and the `ai` throttle (30/minute
cannot explain two failures 16 minutes apart).

### Change

Two independent guards at the same boundary, so neither alone is load-bearing:

1. `send()` returns early when `uploadingFiles` is true.
2. `resourceIds` derives from confirmed attachments only:
   `attachedResources.filter((r) => !r.pending).map((r) => r.id)`.

Guard 2 is the real fix; guard 1 is the UX that stops the button feeling broken.

### Tests

New `frontend/src/test/chatSend.test.jsx` — there is currently **no** frontend
coverage for chat send at all. Assert: a pending placeholder never appears in a
request body; `send()` is a no-op while uploading; a confirmed attachment's UUID
is sent.

---

## B. Role-aware chat suggestions

`SUGGESTIONS` (`ChatPage.jsx:60-81`) is a module-level constant; `user` is
already in scope at `:617` and the page never branches on role.

Convert to a role-keyed lookup, importing `ROLES` from `@/lib/access`, following
the existing pattern at `AppShell.jsx:230-231`. The values are `{icon, title,
prompt}` objects, not strings; the student list keeps the four entries at
`:60-81` verbatim, and the other two sets are new:

```js
const SUGGESTIONS_BY_ROLE = {
  [ROLES.STUDENT]: [ /* :60-81, unchanged */ ],
  [ROLES.LECTURER]: [
    { title: 'Plan a session', prompt: 'Turn my course materials into a one-hour session outline with learning objectives.' },
    { title: 'Build a revision quiz', prompt: 'From my materials, write five exam-style questions with answers and explanations.' },
    { title: 'Explain it simply', prompt: 'Explain the hardest concept in my materials to someone seeing it for the first time.' },
    { title: 'Compare my sources', prompt: 'Where do the documents I have uploaded disagree with each other?' },
  ],
  [ROLES.TENANT_ADMIN]: [
    { title: 'Synthesize a topic', prompt: 'What do our materials say about this topic, and where is the coverage thinnest?' },
    { title: 'Cross-source review', prompt: 'Compare the main arguments across the documents I can access and flag conflicts.' },
    { title: 'Explain a policy', prompt: 'Explain the rules in the policy document I have uploaded, point by point.' },
    { title: 'Draft a briefing', prompt: 'Draft a short briefing note for staff, grounded only in the uploaded materials.' },
  ],
};
```

Unmatched or missing role falls back to the student set.

**Why every prompt above is document-shaped.** The assistant grounds strictly on
retrieved `ResourceChunk` rows (`chat/services/retrieval.py:44` and `:120`);
there is no tool calling and no read access to analytics tables. A suggestion
worded as "which programme has the weakest enrolment" would be answered from
document prose or not at all, so coverage questions are framed as gaps *in the
materials*, and statistics stay on the dashboards that already compute them.

Three corrections made here while reviewing this section against the code: the
values are objects with a `prompt`, not bare strings; the analytics-worded
prompts I first drafted are not answerable by this pipeline; and the student
practice-quiz item stays valid because students keep their generate button
(Part C), not because staff generation exists. Spelling follows the file's
existing "Summarize" rather than introducing a second convention mid-change.

### Test

Assert a lecturer and a student render different suggestion sets from the same mount.

---

## C. Quiz Manager

### Where generation lives

Decision: **keep both, configured for staff only.**

Today generation exists on the *student* page only. `QuizzesPage.jsx:90` is a
ternary in the page's actions slot: staff get a "Manage quizzes" link, students
get the "Generate with AI" button, which posts the hardcoded
`{ num_questions: 5, title: 'Practice quiz' }` at `:63` and never sends
`resource_ids` even though the serializer accepts it. The Quiz Manager
(`AdminQuizzesPage.jsx`) has no generation UI at all. That inverts.

Resolution, stated precisely because "staff only" and "keep the student button"
could otherwise be read as contradicting each other:

- **Staff get the configuration.** Count, difficulty mix, question types and
  reference resources are chosen in the Manager (`/admin/quizzes`), which is the
  only place the config UI exists.
- **Students keep the one-click action, unchanged in shape.** They do not gain
  difficulty or type pickers — an unconfigured student should not have to make
  three decisions to practise. They do gain resource choice, because a practice
  quiz generated from *all* their authorized material is the existing behaviour
  and is the one thing students actually need to steer. `resource_ids` already
  exists on the endpoint; the student dialog passes the same extracted
  `MultiResourcePicker` (below) with no difficulty/type inputs.
- `num_questions` for students stays 5 and stays non-configurable. Raising it is
  a separate decision with cost implications on the AI call.

No auto-generation is removed because none exists: there are no signals on
`Quiz`/`QuizQuestion`, no Celery beat entry, and `seed_demo.py` creates no
quizzes. `generate_quiz_task` (`assessments/tasks.py:79-142`) is reachable only
via explicit `POST /quizzes/generate/`.

### Model changes — migration `0007`

```python
class Difficulty(models.TextChoices):
    EASY = "easy", "Easy"
    MEDIUM = "medium", "Medium"
    HARD = "hard", "Hard"
```

On `QuizQuestion` (models.py:37-64):

- `difficulty = CharField(max_length=10, choices=Difficulty.choices, blank=True, default="")`

`default=""` and a hidden badge when empty — existing questions are not
retroactively labelled with a difficulty nobody assigned. Migration is additive:
`AddField` plus one new choice value.

- Add `QuestionType.MULTIPLE_SELECT = "multiple_select", "Multiple Select"`.
  `max_length=30` already fits.

No `points` field. Score remains `100 * correct / total` (`views.py:199`).

### Answer shape for multi-select

Existing shapes stay as-is: `{index: N}` or `{value: str}`. Multi-select adds:

```python
{"indexes": [0, 2], "values": ["Nlog n", "N log log n"]}
```

The four rules that keep this from being read two ways at implementation time:

1. For a `multiple_select` question the submitted answer is an **array of option
   indexes** (`[0, 2]`). Arrays of strings are not accepted; the take page owns
   that shape, so there is one format to score.
2. Correct only when the **sorted set of submitted indexes equals the sorted set
   of `correct_answer["indexes"]`** — all or nothing. A subset scores zero; there
   is no partial credit and no penalty for over-selecting beyond zero.
3. `[]` and a missing key both count as unanswered, so an unanswered
   multi-select never matches a question whose correct set is empty.
4. `correct_answer["values"]` is stored for the review view only. Scoring reads
   `indexes`. Storing both is what lets the review show text without a
   re-lookup, and it is a documented duplicate rather than a second source of
   truth — `values` is never compared during scoring.

Index-based scoring is the right choice here for a reason beyond tidiness:
`options` is already polymorphic (`models.py:48` — "list of strings or
`{id, text}`"), and the take page normalises it with
`typeof opt === 'string' ? opt : opt.text || opt.id` (`QuizTakePage.jsx:382`).
An index is positional into that rendered list, so scoring never has to know
which of the two option shapes a question happens to use.

**One rename required first.** `QuizTakePage.jsx:311` defines
`isMultiChoice = options.length > 0` — meaning "this question has options", as
opposed to free text. It has nothing to do with selecting several answers, and
the new type makes the name actively misleading: both `multiple_choice` and
`multiple_select` questions have `options.length > 0`, so that variable cannot
distinguish them. It becomes `hasOptions`, and a separate
`isMultipleSelect = q.question_type === 'multiple_select'` drives the checkbox
branch.

### One correctness helper, not two

`views.py:193-198` currently inlines the same three-way comparison that
`answer_utils.is_answer_correct` documents as its single source of truth,
despite that module's docstring promising the paths "never drift apart". The
submit path must **call `is_answer_correct`** instead of duplicating it, and
`is_answer_correct` grows the set branch. This is a net deletion of logic, and
it is what keeps submitted scores and post-submit review from disagreeing.

### Generation contract

Extend, do not parallel. `QuizGenerateSerializer` (`serializers.py:183-189`)
gains:

| Field | Shape | Validation |
|---|---|---|
| `num_questions` | int | unchanged, 1–20 |
| `difficulty_mix` | `{easy:int, medium:int, hard:int}` | optional; when present the counts must sum to `num_questions`, and no count may be negative |
| `question_types` | list of the four type values | optional; when present, non-empty and all values known |

`resource_ids` already exists and becomes actually used.

Defaults for the two optional fields, so "absent" is defined rather than
invented per call site:

- **No `difficulty_mix`** → questions are created with `difficulty=""`, which is
  the same state a hand-authored question without a difficulty is in. The mix is
  an instruction, not a fallback label.
- **No `question_types`** → all four types are eligible, which preserves today's
  behavior of not constraining the model.

`generate_quiz_json` (`common/ai/gemini.py:545-592`) currently hardcodes
"Create {n} multiple-choice questions" and a fixed `multiple_choice` schema hint.
It takes the mix and types as parameters. **The keyless dev-mode stub at
`gemini.py:568-580` must respect the requested count, types and mix** —
otherwise every local test of this feature silently produces one generic
question, and your `GEMINI_API_KEY` is currently unset, so that stub is what
you will actually be exercising.

`_validate_quiz_payload` (`tasks.py:22-46`) drops malformed questions. Three
additions, each with a stated failure mode:

- **Shape.** A multi-select question must carry ≥2 options and a non-empty
  `indexes` list whose entries are valid option positions; anything else is
  dropped by the existing "drop the bad question" rule rather than stored as an
  unscoreable item.
- **Honour the type set.** A question whose type is not in `question_types` is
  dropped, not silently relabelled — relabelling would let the model ignore the
  constraint while the UI reports a mix the quiz does not have. When the
  surviving count is short of what was requested, the job still succeeds and
  reports the actual question count; the Manager shows the created quiz's real
  length, not the requested one.
- **Land the mix in the database.** A difficulty nobody recorded is a badge
  nobody can filter on, so the mix must be persisted, not just sent to the
  model. The prompt asks for a per-question `easy|medium|hard` label;
  `_validate_quiz_payload` keeps a label only while that bucket still has
  budget, then fills any remaining bucket slots in question order. A quiz
  generated with `{easy:3, medium:1, hard:1}` therefore contains exactly those
  counts — the only version of this where the control in the UI is not
  decorative.

### UI

`AdminQuizzesPage.jsx` (627 lines) becomes three things it is not today:

1. **A generation block** on the create dialog: resource multi-select, question
   count, three difficulty inputs, type checkboxes. Polling reuses the existing
   `/jobs/{id}/` pattern from `QuizzesPage.jsx:43-59`.
2. **Question editing.** Today questions can only be added or deleted —
   `PATCH /quiz-questions/{id}/` already works server-side and nothing calls it.
   Options become a real list editor instead of the comma-separated string at
   `:458-472`, and the correct answer is chosen by clicking an option instead of
   typing text that must match exactly (the current failure mode at `:210-217`).
3. **Reorder**, writing `order_index`. Currently write-once at create.

`QuizTakePage.jsx:380-421` renders `role="radiogroup"` with single-index
answers; multi-select needs `checkbox` semantics and an array answer.

**Extract, don't copy.** `MultiResourcePicker` (`ChatPage.jsx:431`) is exactly
the control needed for reference-resource selection, and it is already fully
prop-driven — `{ open, onClose, selected, onToggle }` with no chat state inside.
It moves to `components/shared/` and ChatPage imports it. Duplicating it would
create the same multi-copies-of-navigation disease Part D is removing.

Three details the extraction must handle, because they are chat-specific rather
than picker-specific:

- The query key is `['chat-materials']` (`:433`) and ChatPage invalidates that
  exact key after an upload (`:834`). Both move to one shared key, or the
  extraction silently breaks cache invalidation on the chat side.
- The copy is attachment worded — "Attach materials" (`:461`), "No processed
  materials yet — upload one first" (`:476`). Title and empty-state become props
  defaulting to the current strings, so ChatPage renders identically.
- It positions itself `absolute bottom-full left-0 right-0` for the composer
  popover. The builder dialog needs the same list in normal flow, so the
  positioning is a prop (`popover` | `inline`), not a second component.

Only `processing_status === 'ready'` resources are selectable (`:442-445`), which
is correct for generation too — an unindexed document cannot ground a question.

### Design language

All new surfaces use `DESIGN.md` tokens and the hairline material system:
`panel-surface` opaque panels, `1px var(--border)` hairlines, single violet
accent, no nested cards, no icon above every heading. `AdminQuizzesPage` is
627 lines and `QuizzesPage` 291; the builder and the question editor become
separate components under `pages/quizzes/`, mirroring the `pages/calendar/`
split already performed on `CalendarPage`.

---

## D. Navigation: one source of truth

### Current state

Four complete hardcoded role arrays in `AppShell.jsx` — `SUPERUSER_NAV:86-113`,
`ADMIN_NAV:115-162`, `LECTURER_NAV:164-194`, `STUDENT_NAV:196-225` — chosen by
an `if` ladder at `:227-233`. `LECTURER_NAV:165-193` is identical to
`ADMIN_NAV:116-144`, line for line; `ADMIN_NAV` then appends a "Tenant admin"
section at `:145-161`. Nav data is re-declared independently in
`CommandPalette.jsx:88-216` and `ProfilePage.jsx:425-448`; the user menu
hardcodes its own Profile/Dashboard links a second time (desktop
`AppShell.jsx:337-346`, mobile `:916-922`). Items carry no `roles` key; gating
is which array you happen to receive.

Two unconnected systems therefore gate the same routes: those arrays, and the
`roles` lists in `routes/tenantRoutes.js` enforced by `guards.jsx:15-29`.

**The mechanism behind most of it:** the palette defines its own
`isStaff = role === 'tenant_admin' || is_superuser` (`CommandPalette.jsx:46`),
while `QuizzesPage.jsx:31` defines the same identifier as
`lecturer || tenant_admin || is_superuser`, and `lib/access.js:20` defines the
canonical `STAFF = [lecturer, tenant_admin]`. Three predicates, one name, and
the palette's excludes lecturers. Whether a link appears is a property of which
file renders it rather than of the route.

Six defects that follow, each verified against the current source:

| # | Defect | Evidence |
|---|---|---|
| 1 | Staff → "My courses" → `/forbidden` | palette item is un-gated (`CommandPalette.jsx:135-139`); `/my-courses` is `STUDENT_ONLY` (`tenantRoutes.js:46`) |
| 2 | Lecturer → "My programme" → `/forbidden` | palette gates `!isStaff` (`:152`), and its `isStaff` excludes lecturers (`:46`); route is `STUDENT_ONLY` (`:47`) |
| 3 | Lecturer cannot reach Quiz Manager in ⌘K | Admin group gates `isStaff` (`:176`); `/admin/quizzes` is `STAFF` (`:55`) and `LECTURER_NAV:180` lists it |
| 4 | Tenant admin cannot reach "Assigned courses" in ⌘K | palette gates `isLecturer` only (`:160`); `/assigned-courses` is `STAFF` (`:48`) and `ADMIN_NAV:129` lists it |
| 5 | Tenant admin → "Platform console" → bounced | Admin group renders for `isStaff`, which a tenant admin satisfies (`:176`); `/platform` is `requireSuperuser`, so `guards.jsx:15-18` redirects them to `/admin/dashboard` |
| 6 | ⌘K "Dashboard" → public landing | `go('/')` at `:90`; `/` is the marketing page (`publicRoutes.js`) — see Part E.2 |

### Change

New `src/lib/navigation.js`:

```js
// One flat, ordered list. `roles` uses the SAME constants tenantRoutes.js
// imports, so nav and guard cannot mean different things by the same word.
export const NAV_SECTIONS = [
  { section: 'Workspace', items: [{ to: '/chat', label: 'AI Chat', icon: MessageSquareText, roles: EVERYONE }] },
  // …
];
export function visibleNav(user); // → NAV_SECTIONS filtered for this user
```

`visibleNav(user)` mirrors `guards.jsx` exactly, in the same order:
`is_superuser` sees only `superuserOnly` items and no tenant items (because
`guards.jsx:22` bounces a superuser out of every tenant route); a user with no
`tenant` sees none (same reason, `:25`); otherwise an item is visible when
`item.roles` includes `user.role`. `superuserOnly` exists because `is_superuser`
is a separate boolean, not a role value (`accounts/models.py:34-37` yields
exactly `student`, `lecturer`, `tenant_admin`). Items with no `roles` key are a
test failure rather than a default — an un-gated link is how defect 1 happened.

Sidebar, mobile drawer, ⌘K and Profile shortcuts all consume `visibleNav`; the
four arrays and both local `isStaff` constants are deleted, not kept as
adapters.

**The invariant that makes this stick** — a test that, for every nav item,
asserts its `to` resolves to a declared *tenant* route and that the set of roles
`visibleNav` admits for that item equals the set that route's `roles` admits
(and, for `superuserOnly` items, that the route is `requireSuperuser`). Each of
defects 1-5 is exactly an item whose declared audience would not match its
route's, so a future divergence in either system fails the suite instead of
reaching a user. Defect 6 fails the resolution check directly: `/` is a public
route, so it cannot be declared as a tenant nav item at all.

### Naming

| Now | Becomes | Why |
|---|---|---|
| "Quizzes" + "Quiz Manager" (staff, `:130-131` / `:179-180`) | one item: **"Quizzes"** → `/admin/quizzes` | Staff author quizzes; one label, one destination. See the reachability rule below — this is only safe because the Manager gains a link to the take view |
| "Quizzes" (student, `:211`) | **"Quizzes"** → `/quizzes` | Same label, role-appropriate destination |
| "Upload" → `/resources/upload` (`:132`, `:181`) | **"Add material"** | The page adds documents to the RAG library with a six-level visibility scope — private, course, programme, department, faculty, institution (`resources/models.py:14-21`); "Upload" reads as a generic file drop and is indistinguishable from the timetable import |
| "Timetable Upload" → `/admin/upload` (`:157`) | **"Import timetable"** | Stops the two uploads sharing a stem |
| `Upload` icon | `LibraryPlus` | Frees the upload glyph for genuine import jobs |
| palette "Upload material" + "Upload new material" (`:111-115`, `:208-215`) | one ⌘K item, **"Add material"** | Two palette entries already point at the same route from two different groups |

**Reachability rule, and why the consolidation needs it.** Collapsing two items
into one must not strand a route. Verified today: `QuizzesPage.jsx:90-96` links
staff *to* the Manager, but `AdminQuizzesPage.jsx` contains no link back to
`/quizzes` — the only staff path to the practice/take view would disappear with
the second sidebar item. So the Manager gains a "Student view" action in its
header pointing at `/quizzes`, and the parity test asserts the reverse direction
too: every declared route reachable by a role is reachable from that role's nav
or from a link on a page already in that nav.

### Also

- Delete the orphan route `/calendar/new` (`tenantRoutes.js:74`) — it is the same
  `CalendarPage` as `/calendar`, and grep over `src/` returns only its own
  declaration, so nothing links it.
- Collapsed rail: items currently hide the label span and mark the icon
  `aria-hidden` (`AppShell.jsx:262-263`), leaving `title` as the only accessible
  name — the weakest rung of the accessible-name computation. Add a real
  `aria-label`.
- `docs/FRONTEND_STACK.md:168` states routes are protected in `AppShell.jsx`.
  That is the misconception behind the drift; correct it to `guards.jsx` +
  `tenantRoutes.js`.

---

## E. Incidental defects fixed

1. `QuizTakePage.jsx:234` promises "answers are saved as you go". They are not
   — answers are plain `useState` (`:37`) and a reload loses the attempt. Fix:
   correct the copy to say what actually happens (answers are held until you
   submit). Persisting in-flight answers is a separate feature and out of scope.
2. `CommandPalette.jsx:90` "Dashboard" navigates via `go('/')`, which is the
   public marketing page (`publicRoutes.js:12`). Fix: delete the bespoke entry.
   Once the palette consumes `visibleNav` (Part D) the correct dashboard item is
   already contributed per role — `/dashboard` for students and lecturers,
   `/admin/dashboard` for tenant admins, `/platform` for superusers — and
   `NAV_SECTIONS` can keep static `to` values instead of carrying a dynamic
   destination. `roleHome(user)` (`lib/access.js:35`) stays the place that
   mapping lives, used by item 6.
3. `CommandPalette.jsx:94,101,108` advertise `G D` / `G C` / `G R` chords. Only
   `mod+b` and `mod+k` are bound globally (`AppShell.jsx:673`, `:675`) and
   `useKeyboardShortcut` parses `+`-delimited combos, not two-key sequences — so
   those hints describe a capability that does not exist. Fix: delete the three
   `<Shortcut>` hints. Building a chord system is out of scope; the palette is
   already searchable.
4. `LandingPage.jsx:658` renders "12 sources" over a list of four chips
   (`:661-665`), and every chip's citation is the same hardcoded literal
   `Page 42 · §3.2 · Verified` (`:674`) while only the score varies. Fix: derive
   the count from the array (`{chips.length} sources`) and give each entry its
   own page/section in the array, so the number cannot drift from the list again
   and four documents do not claim one page. No new claims are invented: the
   figures stay visibly illustrative, as the section already is.
5. `AdminQuizzesPage.jsx:84-88` invalidates query key `['dash-quizzes']`, which
   no component ever queries. Dead line.
6. `AppShell.jsx:343-346` hardcodes the user menu's "Dashboard" link to
   `/dashboard`, so a tenant admin gets redirected by `guards.jsx` and a
   superuser gets bounced to `/platform` — both correct-by-accident, but the
   label is wrong for the destination. Fix: `roleHome(user)`, same helper as
   item 2.

---

## F. Local RLS remediation

Django connects as `academiai` (`settings.py:152` default, `.env`
`POSTGRES_USER=academiai`). In the live volume that role is
`rolsuper=t, rolbypassrls=t`. Tables are owned by `academiai_app` with both
`relrowsecurity` and `relforcerowsecurity` set across 45 policies — the intent
is correct — but **a superuser bypasses RLS regardless of FORCE**, so no query
in this environment is filtered.

### Why the volume looks like this

Both halves trace to one commit, `ad92276` (2026-09-20, "rename default postgres
role from academiai_app to academiai"). It renamed the role in
`01-app-role.sql`, `settings.py`, `.env.example`, `test_rls.py` and the docs —
including `ALTER SCHEMA public OWNER TO academiai` — but init scripts run only
on first container init. So on the existing `postgres_data` volume:

- `academiai` still exists with the **superuser** attribute the old bootstrap
  gave it, and the script's defensive `ALTER ROLE academiai NOSUPERUSER
  NOBYPASSRLS` branch never ran.
- Objects created before the rename are still **owned by `academiai_app`**,
  which is now a role nothing connects as.

### The trap that makes ordering matter

`GRANT USAGE, CREATE ON SCHEMA public` and schema ownership do **not** let a
role run `ALTER TABLE` on a table it does not own. So stripping `academiai`'s
superuser attribute first would break the next additive migration — Part C's
`0007` runs `ALTER TABLE quiz_questions ADD COLUMN`, and that fails with
`must be owner of table quiz_questions`. Ownership must move **before** the
privilege does.

The same split explains a quieter one: `apps/common/apps.py:27-35` wraps the
post-migrate policy DDL in `except Exception: logger.exception(...)` precisely
"e.g. a role without DDL rights". Under a superuser that never fires; after a
naive privilege strip it would start swallowing every policy statement and RLS
would be half-configured with a green migrate.

### Plan (additive, no volume deletion, no data loss)

You run steps 1-3 as SQL; I run the verification queries and the suite and
report actual output. Order is not interchangeable.

1. **Create the declared bootstrap superuser `postgres`** with a password you
   choose, so a privileged role exists that is not the app role. Must happen
   while `academiai` can still grant it.
2. **Move object ownership to the app role:** `REASSIGN OWNED BY academiai_app
   TO academiai`, then confirm zero relations in `public` are still owned by
   `academiai_app`. Sequences and the schema itself are covered by
   `REASSIGN OWNED` plus the `ALTER SCHEMA public OWNER TO academiai` the init
   script already intends.
3. **Then strip the privilege:** `ALTER ROLE academiai NOSUPERUSER NOBYPASSRLS
   LOGIN` — exactly the defensive branch at `01-app-role.sql:22-26`.
4. **Verify** `pg_roles` shows `academiai` with `rolsuper=f, rolbypassrls=f`,
   and `pg_tables` shows every `public` table owned by `academiai`.
5. **Restart the dev server, run `migrate` then the backend suite.** A missing
   grant that superuser implicitly covered surfaces as an explicit `GRANT`, not
   as a restored privilege.
6. **Prove isolation is live:** a tenant-scoped query with no tenant GUC returns
   nothing where it previously returned everything, and the migrate output
   contains no "Failed to auto-apply RLS policies" line.

This is deliberately not attempted silently: it changes database role state and
can take the running server down on a permissions error. If step 2 or 3 fails
halfway, the recovery is `ALTER ROLE academiai SUPERUSER` (via `postgres`) and
re-run — nothing is destroyed, which is why this is safe to do additively rather
than by wiping the volume.

## G. Resources library

Your questions here were "how can the resource page be improved — filter by
uploaded by (student, lecturer, tenant admin), should materials be grouped by
course, how does that affect the UI". Answers below, plus one prerequisite the
code review turned up that outranks all of them.

### G0. Prerequisite: the library is capped at 20 materials, and filters run on that slice

`DefaultPagination` sets `page_size = 20`, `max_page_size = 100`
(`common/pagination.py:6-8`). `ResourcesPage.jsx:107` requests `/resources/`
with only `scope` — no `page`, no `page_size` — so it receives the **first 20
rows** and stores them as the whole library (`:108`). Then `:216-218` paginates
that array client-side at `PAGE_SIZE = 12`:

```js
const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
```

Consequences, in order of severity: with more than 20 materials, the remainder is
unreachable through this page; every existing control — search, visibility
scope, processing status, sort (`:165-195`) — filters and sorts only those 20,
so search silently misses documents that exist; and the pager offers two pages
of a set it believes is 20 long. The `counts` chips at `:198-205` report
"ready/processing/failed" for the same truncated sample, so they can disagree
with reality.

The same class of bug: `AdminQuizzesPage.jsx:57` and `:62`, and
`CourseDetailPage.jsx:172` also fetch without pagination params. The intended
pattern already exists in this codebase — `QuizzesPage.jsx:38` sends
`page_size=50` and `ChatPage.jsx:435` sends `page_size=200`.

**Fix, and note that it is almost entirely frontend.** The backend already
supports what this page reimplements badly: `SearchFilter`,
`DjangoFilterBackend` and `OrderingFilter` are all global defaults
(`settings.py:220-224`), and `search_fields = ["title", "description"]` plus
`filterset_fields` are declared on the viewset (`resources/views.py:350-351`).
So the query sends `page`, `page_size`, `search` and `ordering` as parameters,
uses the DRF response's `count` for `totalPages`, and `Pagination` becomes a
server-page control rather than an array slicer. Filter changes reset `page` to
1 — otherwise a narrower filter can leave the user on a page that no longer
exists. The `refetchInterval` polling for in-flight processing (`:110-117`)
stays, but must poll the current page, not a whole-library query.

This precedes G1-G2 for a practical reason, not a tidy-ordering one: a role or
course filter applied over 20 rows reads as *the filter losing things*, which is
how a correct feature gets reported as broken.

### G1. Filter by uploader role

`Resource.uploaded_by` FK exists (`resources/models.py:61-63`) and the serializer
already exposes `uploaded_by_username` (`serializers.py:6`), but the payload
carries **no role**, and `uploaded_by` is not in `filterset_fields`
(`views.py:351`). So neither dimension is available to the page today.

- Backend: add `uploaded_by__role` to the filterset, and `uploaded_by_role` to
  `ResourceSerializer`'s read-only fields, sourced from the same FK the username
  already uses.
- Frontend: one "From" select in the existing filter row — Anyone / Students /
  Lecturers / Institution admin — mapping to `student`, `lecturer`,
  `tenant_admin` from `accounts/models.py:34-37`.

**Why this cannot widen visibility.** The scope rules are applied in
`get_queryset` (`views.py:235-317`) *before* the filterset runs, and `uploaded_by`
is on the `TenantScopedModel` base, so RLS has already narrowed rows. A filter can
only remove results. That is worth stating because an identity-field filter is
the natural place to look for a leak.

Audience: all roles, per your answer. A student filtering to "Lecturers" is
narrowing their own authorized set, which is a legitimate study need.

### G2. Filter by course, not grouped by course

`course_offering` is already filterable — it is in `filterset_fields`
(`views.py:351`) and the queryset `select_related`s it (`:336-337`), and
`ResourcesPage.jsx:135` already loads `/course-offerings/?page_size=200` for the
create dialog, so the dropdown needs no new fetch.

Two details that make it honest rather than half-working:

- **The above-course case is the majority, not the exception.** `course_offering`
  is nullable (`models.py:33-38`) and four of the six visibility scopes live
  above course level (programme, department, faculty, institution). Exact-pk
  filtering therefore cannot express "not attached to a course", so the filterset
  gains `course_offering__isnull` and the dropdown gets an "Above course" entry
  alongside real offerings.
- **Grouping was rejected for a structural reason, not a taste one.** Sectioned
  rendering needs every row of a group present at once; under G0's server
  pagination a group can straddle pages, so a "Thermodynamics 2024 (7)" heading
  would be a lie about a page that holds 3 of them. A filter narrows the server
  query instead and keeps its own count true. If grouped browsing is wanted later
  it needs a grouped endpoint, which is a separate change with its own spec.

### Design language

Same contract as Part C: `DESIGN.md` tokens, `panel-surface`, hairline borders,
no nested cards. The filter row is the existing one at `:404-450` — new selects
join it rather than starting a second toolbar, and the active-filter chips at
`:499` already render clears, so the two new filters plug into a pattern the page
owns. `ResourcesPage.jsx` is 645 lines; the filter bar and the create dialog
become components under `pages/resources/`, mirroring the `pages/calendar/` and
`pages/quizzes/` splits.

Both filters apply to every role: they narrow what is already visible to you,
and the scoping rules in `views.py` are untouched. The one admin-only extra the
review found is moderation, and that is its own part.

## H. Resource moderation workflow

Separated from G by your decision on 2026-09-22. Recorded here in full so the
finding is not lost between plans — G ships without it, and nothing regresses,
because this code is unreachable today rather than broken.

### The finding

Searching `frontend/src` for `moderate`, `report` and `moderation_status` returns
**zero** application callers — only a `CommandPalette` comment about cmdk and
"removed" toast strings, re-verified on 2026-09-22. Meanwhile the backend
implements the whole lifecycle:

- `report` (`resources/views.py:626`) — any tenant member may flag material with
  a reason, creating a `ResourceReport` and moving the resource to `flagged`.
- `moderate` (`:691`, `IsLecturerOrAdmin`) — `dismiss` restores `active`,
  `remove` sets `removed`; both audited; both 409 without a pending report.
- Visibility already honours it: `removed` is hidden from every role, `flagged`
  is scoped per role, and the uploader can always see their own
  (`views.py:240-317`). `ModerationStatus` is otherwise fully wired
  (`models.py:28-31`).

So a user cannot report a problem document, and an admin has no queue to review.
The consequence is operational: reporting is the mechanism that pulls a wrong or
mis-filed material out of retrieval (`report` flips it to `flagged`, which is
already hidden from retrieval and from student listings per `views.py:631-632`),
and no tenant member can invoke it. A lecturer who spots a bad PDF must email
someone with server access.

Worth recording so H's estimate is honest: the backend path **is** covered by
API tests (`resources/tests/test_moderation.py:134-262` — report flags and
audits, flagged is hidden from student listings and retrieval, dismiss restores,
remove hides, a student may not moderate). That coverage is why the code still
works; the gap is purely that nothing in the SPA can reach it.

### Shape when it is planned

Four pieces, none novel to this codebase:

1. **Report affordance** on the resource card and in the detail dialog — a
   reason prompt calling the existing `report` action. `ResourceReport.Reason`
   is a closed enum of `inaccurate | copyright | offensive | other`
   (`views.py:621-624`), so the UI offers those four plus optional free text
   (`details`, truncated to 2000 chars server-side). Available to any tenant
   member who can see the material; a duplicate pending report from the same
   user returns 409, which should read as "already pending", not an error.
2. **Queue page** listing resources with pending reports plus the reason and
   reporter, with `dismiss` / `remove` wired to `moderate`. Lecturer and tenant
   admin only; `IsLecturerOrAdmin` already enforces it server-side, and
   `moderate` 409s when there is no pending report.
3. **One backend addition for the queue**: there is no list endpoint for
   `ResourceReport`, and `moderation_status` is not in `filterset_fields`
   (`views.py:351` declares only `processing_status`, `visibility_scope`,
   `course_offering`). The narrow route is to add `moderation_status` to
   `filterset_fields` so the queue lists `?moderation_status=flagged`, and to
   surface each flagged row's pending reports (reason, reporter, date) on the
   resource serializer via `prefetch_related` — a reports ViewSet would have to
   reimplement the resource scoping rules in `views.py:240-317` to stay safe,
   which is the larger and more error-prone option. Per-row report reads must
   not become an N+1 on a paginated list.
4. **Route + `NAV_SECTIONS` entry**, which Part D's parity test will police —
   declared there or the test fails, which is the point of doing D first.

`remove` is soft (`moderation_status`), not deletion — the row and its stored
file stay. H must make that visible in the UI copy so an admin does not believe
they have destroyed a document they have only hidden.

---

## Scope of this spec, and how it becomes plans

C, D and G are each large enough to be their own delivery; A, B, E and F are not.
The implementation plan therefore splits along the existing part boundaries
rather than inventing a new grouping: **A + F first** (one short plan — chat fix
plus environment, both independent of code structure), then **D**, then **C**,
then **G**, then **B + E**. C and G are the parts that can be further deferred
without blocking anything else, and both their migrations are additive, so a
pause between a part's backend contract and its UI leaves the app working. **H is
specified here but explicitly not scheduled** — per your decision it waits until
G ships, and its own plan comes from this section rather than from G's.

## Testing strategy

**Backend:** multi-select scoring as set equality — exact match, superset,
subset, empty array, missing key; a review recomputed through
`is_answer_correct` agrees with the stored score for all five; `difficulty_mix`
sum/negative validation; a generated quiz with `{easy:3, medium:1, hard:1}`
contains exactly those difficulty counts (which is what proves the mix is
persisted, not just prompted); out-of-type payload questions are dropped and the
response reports the real count; the keyless stub honours count, types and mix;
`correct_answer` is not exposed to students pre-submission for the new shape
(extends `test_evaluation_gaps.py`); migration 0007 applies on the existing DB
**after** Part F, so it is exercised under enforced RLS rather than bypassed.
For G: the list endpoint returns `count` from the DB rather than the length of
the current page, and `page_size=100` is accepted while `page_size=1000` is
clamped; `?uploaded_by__role=lecturer` narrows rows without widening them, so an
uploader-role filter can never surface a resource the scope rules at
`views.py:240-317` would already have hidden; `?course_offering__isnull=true`
returns the above-course scopes and excludes course materials. Part H, if and
when it is planned, adds one backend test first: the
`report`→`flagged`→`moderate(dismiss)`→`active` round trip already exists, so
what H needs coverage for is the `?moderation_status=flagged` filterset. The
`report`/`moderate` actions themselves are already API-tested
(`test_moderation.py:134-262`), which is why they still work despite having no
UI.

**Frontend:** chat send guards (new file — none exists today); role-keyed
suggestions; the nav↔route parity invariant of Part D, including the
reachability rule; quiz builder payload shape; multi-select take-page
interaction and the `hasOptions` / `isMultipleSelect` rename; for G the request
shape (page + filters are query params, and changing a filter resets to page 1),
pagination controls driven by server `count` rather than array length, and each
new filter select's clear-chip.

**Verification before any completion claim:** `npm run lint` (oxlint),
`npm run build`, `npm test`, `pytest -q`, and the Impeccable detector on changed
JSX. Browser QA of the quiz builder in light and dark is only possible for
public pages under the standing constraint — `/admin/quizzes` and `/chat` are
behind auth, so they stay test-verified unless you supply a demo account.

**Known load-sensitivity:** `routing.test.jsx` intermittently fails its 15s cold
mount budget under full-suite parallelism. Documented, not yet fixed.

## Out of scope

Persisting in-flight quiz answers; per-question weighting; essay/hand-marked
questions; gap-fill and matching types; difficulty or type pickers on the student
practice flow (assumption 5); a `g`-prefixed chord system (E.3 removes the hints
instead); removing the `generation_job_id` column (harmless, needs a migration);
the `text-[Npx]` typography debt; landing imagery (tracked separately in task
#13); grouping materials by course (rejected in G2, with the reason); grouping
`ResourceReport` into its own ViewSet (H uses the resource list's filters instead).

## Order of work

1. **A** — chat fix. Independent, unblocks daily use, touches no shared
   structure.
2. **F** — RLS roles, with you watching. Early, because everything after it is
   then verified under genuinely enforced isolation.
3. **D** — navigation, plus the parity test, so the quiz work lands in a
   structure with one source of truth instead of adding another copy.
4. **C** — model and generation contract, then the builder UI. **Hard
   dependency:** `0007` runs `ALTER TABLE quiz_questions ADD COLUMN`, which
   requires table ownership, so it must come after F's ownership reassignment.
   Before F it works only because the app role is accidentally a superuser.
5. **G** — resources library. After C and D, per your answer. G0 (server
   pagination) is not reorderable within it: the two new filters are only
   trustworthy once they run over the whole library rather than the first 20 rows.
6. **B, E** — suggestions and incidental fixes.
7. **H** — moderation UI. Not scheduled. Planned after G ships, from its own
   plan, and it inherits two things by then: `NAV_SECTIONS` from D (its queue
   route must be declared there or D's parity test fails) and the paginated list
   fetch from G0 (the queue is a filtered resource list, not a second fetch
   implementation).

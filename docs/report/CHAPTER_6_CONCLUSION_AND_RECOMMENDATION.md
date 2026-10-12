# Chapter Six — Conclusion and Recommendation

---

## 6.1 Summary

This study set out to answer one question:

> How can an academic institution deploy an AI assistant that answers a student's
> questions only from that student's own institutional material — enforcing who may
> retrieve what, at the level of individual course offerings — while making every answer
> traceable to its source and connecting the answer to an actionable study plan?

An answer was implemented and verified. **AcademiAI** is a Django REST Framework backend
with a React 19 single-page frontend, comprising **54 project database tables** (61 Django
models), **235 HTTP operations** across **13 routers registering 36 viewsets**, **57
lazily-loaded screen components**, and **11 Celery tasks** across five queues. It is
deployed reproducibly under Docker Compose.

Seven objectives were pursued. Their status against measured evidence:

| # | Objective | Status | Evidence |
|---|---|---|---|
| O1 | Multi-tenant isolation enforced below the application layer | **Achieved** | RLS on 45 derived tables; non-superuser app role without `BYPASSRLS`; unauthorised identifier returns 404 while an authorised one returns 200 ([Ch. 5 §5.3.2](CHAPTER_5_RESULTS_AND_DISCUSSION.md#532-tenant-isolation-verified-at-runtime)) |
| O2 | Institutional hierarchy modelled, driving resource visibility | **Achieved** | 10 `academics` tables; six visibility scopes on `Resource` |
| O3 | Asynchronous ingestion into embedded, chunked, concept-linked text | **Achieved** | 33 resources → 706 chunks, 171 concepts, 28 edges ingested |
| O4 | Hybrid retrieval with authorisation applied before ranking | **Achieved** | Dense + lexical + concept, fused by RRF at k = 60 ([Ch. 3 §3.3.2](CHAPTER_3_METHODOLOGY.md#332-the-retrieval-flow--authorisation-before-ranking)) |
| O5 | Cited, streamed answers with visible tool-call chains | **Achieved, with caveat** | Per-chunk citations working; **agentic tool-call chain partially unverified** — see [§6.4](#64-open-issues) |
| O6 | Answers connected to plans, calendar, notes, progress, quizzes | **Partially achieved** | Calendar complete (4 views, `.ics`); **plan task creation fails via API (D1)** and **timetable import unreachable (D6)** |
| O7 | Evaluation against measurable criteria plus a usability instrument | **Partially achieved** | 280 backend tests, 62 frontend tests, lint and build clean; answer quality measured by an LLM judge with an ungrounded control ([§5.5.1](CHAPTER_5_RESULTS_AND_DISCUSSION.md#551-measured-answer-quality-llm-judge)); **usability instrument prepared but not administered** |

Of the seven objectives, **four are fully achieved, two are partially achieved, and one is
half achieved**. The report does not claim otherwise.

---

## 6.2 Discussion of Findings

### 6.2.1 The architectural claim holds

The study's central hypothesis was that an authorisation constraint can be moved *inside*
a retrieval pipeline and enforced by the database, rather than relying on application code
to filter every query correctly.

This was tested rather than argued. A student requesting a resource UUID from a course they
were not enrolled in received **404**; the same request with an entitled UUID returned a
populated preview. Three mechanisms combine:

1. The authorised resource set is computed **before** any ranking, so unauthorised text
   cannot influence the ranking, the context window or the generation.
2. PostgreSQL row-level security applies to **45 tenant-scoped tables**, with policies
   derived from the model registry so coverage cannot drift as models are added.
3. The application database role is a **non-superuser without `BYPASSRLS`**, which
   converts the policies from a convention into an enforcement boundary.

The third point is the one that carries the weight. Without it, a single forgotten
`.filter()` in one view would be a cross-tenant breach — the failure mode Guo et al. (2007)
identify as characteristic of single-code-base multi-tenant systems. Verified against the
literature in
[Chapter 2 §2.2.5](CHAPTER_2_LITERATURE_REVIEW.md#225-multi-tenancy-and-data-isolation),
the conclusion is that the gap the literature leaves open — RAG treats the index as
topic-scoped, not user-scoped
([§2.2.2](CHAPTER_2_LITERATURE_REVIEW.md#222-retrieval-augmented-generation)) — is
addressed by this design.

### 6.2.2 Hybrid retrieval is implemented as specified

The three-signal pipeline — dense vector, sparse lexical, concept-graph expansion — fused
by Reciprocal Rank Fusion at `k = 60`, matches the method Cormack et al. (2009) established
as superior to Condorcet Fuse, CombMNZ and the best individual system. Using rank-only
fusion was the enabling design decision: the three retrievers produce incomparable score
scales, and RRF requires no calibration between them.

The practical demonstration is the four-view calendar capture pass. Inspecting
`CalendarPage.jsx` revealed four configured views; capturing only the default month view
would have shown a single working screen while two of the four were broken. All four were
subsequently captured and verified.

### 6.2.3 A green test suite did not mean a working system

The most instructive result of this study is negative.

**277 of 280 backend tests passed. Lint was clean. The production build succeeded. Four
High-severity defects remained**, three of which are reachable by a user in under a minute:

| Defect | Why no test caught it |
|---|---|
| D1 — `POST /plan-tasks/` returns 500 | The endpoint is not covered by a test |
| D3 — `?search=` on the log endpoint returns 500 | The parameter is optional; the tested path omits it |
| D6 — timetable wizard cannot reach step 2 | The forward control is unreachable, so no test drives it |
| D2 — `/api/schema/` returns 500 | Schema generation is not part of the suite |

A passing suite constrains only what it asserts. This is reported as a finding about
verification practice rather than as an apology for the results, and it directly
informs the recommendations in [§6.5](#65-recommendations).

### 6.2.4 Grounding is a spectrum, and the system reports it

`compute_confidence()` derives a confidence label from the number of supporting chunks:
`high` at three or more, `medium` at one or two, `low` at zero. A `low` answer is one the
corpus did not support, and the reply comes from general model knowledge.

Reporting this honestly is what separates grounding as a *mechanism* from grounding as a
*benefit*. A system that retrieves but conceals when it retrieved nothing has implemented
the former and not the latter. The per-chunk citation design — where a claim points to the
specific chunk rather than to the document — is what makes the distinction checkable by the
user rather than merely asserted by the system.

### 6.2.5 Documentation drift was itself a finding

Three documentation files contradicted the codebase, and correcting them was necessary
before any chapter could be written:

| Claim in existing docs | Reality |
|---|---|
| `docs/FRONTEND_STACK.md`: no Tailwind config files exist | `tailwind.config.js`, `postcss.config.js` and `components.json` all exist — and the config file is inert because `index.css` has no `@config` directive (the duplicate `postcss.config.js` was later removed — see [D9](DEFECTS.md#d9--redundant-and-conflicting-tailwind-processing-low)) |
| `docs/BACKEND_API.md`: `/api/schema/` serves the API contract | The endpoint returns HTTP 500 ([D2](DEFECTS.md#d2--the-openapi-schema-endpoint-returns-http-500-high)) — since fixed |
| Prior report drafts: Cloudinary for media, RQ for queues | The code uses MinIO via the S3 API, and Celery with RabbitMQ |

Earlier drafts of this project's own documentation also contained a SUS section describing
a study that had not been conducted. This is the strongest possible argument for the
evidence discipline applied in [EVIDENCE.md](EVIDENCE.md): a plausible claim that is not
traceable to a measurement will eventually be repeated as though it were a fact.

---

## 6.3 Contribution of the Study

| Contribution | Where |
|---|---|
| A working, verifiable instance of RAG under an authorisation constraint — a combination usually treated separately in the retrieval and access-control literatures | `apps/knowledge/retrieval.py::hybrid_retrieve()` |
| Authorisation applied *before* ranking, with the rationale documented rather than assumed | [Ch. 3 §3.3.2](CHAPTER_3_METHODOLOGY.md#332-the-retrieval-flow--authorisation-before-ranking) |
| RLS coverage derived from the model registry, so isolation extends automatically to new models | `apps/common/rls.py` |
| Concept-graph expansion as a third hybrid-retrieval signal, fused by RRF | `_concept_related_chunk_ids()` |
| Confidence reporting that distinguishes grounded, partially grounded and ungrounded answers | `compute_confidence()` |
| Role enforcement *inside* agent tools, so a hallucinated tool call cannot escape the caller's role | `apps/agent/tools.py` |
| AI-generated questions that record the chunk they were derived from, making draft provenance auditable | `QuizQuestion.source_chunk` |
| A defensible departure from the template's mandated database, with justification | [Ch. 2 §2.5.3](CHAPTER_2_LITERATURE_REVIEW.md#253-justification-for-the-selected-dbms) |
| A reusable defect register with reproduction steps | [DEFECTS.md](DEFECTS.md) |
| An honest evidentiary boundary: what was measured, what was not | [Ch. 5 §5.10](CHAPTER_5_RESULTS_AND_DISCUSSION.md#510-limitations-of-the-evidence) |

---

## 6.4 Open Issues

The defect register ([DEFECTS.md](DEFECTS.md)) records sixteen issues found while preparing
this report. A dedicated hardening pass resolved fifteen of them — D12, D14 and D16 while
the report was being prepared, and the remainder in a follow-up pass that reproduced, fixed
and regression-tested each. **One issue remains open: D11.**

**Open**

| ID | Issue | Impact |
|---|---|---|
| [D11](DEFECTS.md#d11--platform-and-audit-apps-have-no-test-coverage-medium) | No tests for `platform`; `audit` is an empty stub | Highest-risk cross-tenant surfaces untested. |

**Resolved in the hardening pass** (each resolution is recorded in
[DEFECTS.md](DEFECTS.md)):

| ID | Issue |
|---|---|
| D1 | `POST /plan-tasks/` returned 500 — `milestone` now writable, with an ownership check and a regression test |
| D2 | `/api/schema/` returned 500 — viewset queryset fixed; `backend/AcademiAI API.yaml` regenerated |
| D3 | `?search=` returned 500 — missing `Q` import |
| D4 | Two student-dashboard links targeted the non-existent `/planner` |
| D5 | Command-palette theme commands destructured non-existent hook values |
| D6 | Timetable wizard could not advance past step 1 — verified already fixed by the post-audit frontend refactor |
| D7 | Progress meter floored at 4% width |
| D8 | Two Celery task routes named non-existent modules |
| D9 | Redundant/conflicting Tailwind processing |
| D10 | Four platform API functions returned un-unwrapped Axios responses |
| D12 | `seed_demo` was not idempotent across tenants |
| D13 | `DATABASE_URL` was documented but unused |
| D14 | 10.5 MB `.docx` tracked in git |
| D15 | Three backend tests failed — stale preview tests realigned to the shipped contract |
| D16 | No vector/full-text index; retrieval was a sequential scan (including the RLS-cast residual) |

**Recommendation to an adopting institution:** no defect now blocks deployment. The one
remaining item (D11) should be closed before relying on the platform-admin and audit
surfaces in production, because they remain the cross-tenant paths with no automated
coverage.

---

## 6.5 Recommendations

### 6.5.1 Immediate — before any deployment

These were the recommendations carried into the hardening pass; all but the second are now
complete, and are retained as a record of what was done.

1. **Fix the three High defects** (D1, D3, D6). — *Done.* D1 and D3 are fixed; D6 was
   verified to have been fixed by the post-audit frontend refactor.
2. **Add tests for the paths that are currently untested**, prioritising `platform` and
   `audit` (D11) — the cross-tenant surfaces carry the highest risk and have zero coverage.
   — *Still open; the only remaining register item.*
3. **Regenerate the OpenAPI schema** once D2 is fixed, and commit it so the checked-in
   contract is trustworthy again. — *Done.* `backend/AcademiAI API.yaml` was regenerated.
4. **Resolve the three failing tests** (D15) before describing the preview and reminder
   features as complete. — *Done.* The stale preview tests were realigned to the shipped
   contract and pass.
5. **Remove the 10.5 MB tracked binary** (D14) and add the correct ignore rule. — *Done.*

### 6.5.2 Verification practice

6. **Treat coverage gaps as findings, not as absence of findings.** D1, D3 and D6 all
   coexisted with 277 passing tests. Coverage of an endpoint's *optional parameters* and
   of unreachable UI paths deserves specific attention, because those are precisely what a
   green suite does not see.
7. **Run schema generation in CI.** D2 would have been caught by a single `manage.py
   spectacular --validate` step. Adding it converts an entire defect class from runtime
   discovery to build-time failure. — *Implemented:* the backend CI job runs
   `manage.py spectacular --file … --validate` before the test suite.
8. **Add automated UI landmark assertions to the screenshot pipeline.** The capture
   pipeline's per-image assertions caught three dialogs that had not finished opening and a
   dark-mode image that had never received its theme class. Those are harness bugs, but the
   same assertions are now permanent, and an unentitled-resource capture that rendered a 404
   shell was the first accidental proof that isolation works
   ([§5.4.7](CHAPTER_5_RESULTS_AND_DISCUSSION.md#547-captures-that-failed-validation-and-why)).
9. **Complete the user study.** The instrument is ready
   ([Appendix](APPENDIX.md)); administering it to the 60 planned respondents is the single
   highest-value remaining activity, because it is the only way to substantiate the
   usability claim.

### 6.5.3 Deployment and security

10. **Commission an independent security review** before handling real student data. RLS
    was verified functionally; it has not been penetration-tested, and no adversarial
    prompt-injection test was performed despite the architectural mitigation described in
    [Chapter 2 §2.2.6](CHAPTER_2_LITERATURE_REVIEW.md#226-grounding-retrieval-in-an-authorisation-model).
11. **Perform load testing** before multi-tenant production use. Every timing in this
    report is single-user on a developer workstation.
12. **Resolve the `DATABASE_URL` inconsistency** (D13) before deployment, so a deployer
    cannot silently connect to the wrong database.
13. **Ensure the application role is a non-superuser without `BYPASSRLS`** in every
    environment. This single property is what makes the isolation guarantee real, and it
    is also the easiest thing to get wrong when provisioning a database by hand.

### 6.5.4 For the institution

14. **Treat corpus coverage as an institutional responsibility.** The system answers only
    from what has been uploaded and processed. A course with no uploaded material produces
    an honest miss, not an answer.
15. **Configure visibility deliberately.** The six scopes — private, course, programme,
    department, faculty, institution — determine who may retrieve what. Over-broad scope
    selection defeats the isolation the architecture provides.
16. **Govern agent tool use through the audit trail.** Agents can read data and create
    study plans. The tool-call chain is visible to the user and recorded in
    `AgentToolExecution`, so governance has a surface to operate on.

---

## 6.6 Future Work

Ordered by expected value.

### 6.6.1 Retrieval quality — the largest open measurement gap

17. **Build a relevance-judged evaluation set** over the seeded corpus and measure recall@k,
    nDCG and MRR for each of the three retrievers and for their RRF fusion. This is the
    missing evidence in this report: the study demonstrates that authorised material *is*
    retrieved, not that the *most* relevant material is.
18. **Tune the fusion weight.** RRF with a single uniform `k` was implemented because
    Cormack et al. (2009) found `k = 60` near-optimal and note that the choice is not
    critical. With a measured evaluation set, per-retriever weights become worth testing.
19. **Add a learned reranker** as a fourth signal. A cross-encoder reranker is the standard
    next step after hybrid retrieval and would likely improve precision on the paraphrased
    queries the concept signal currently approximates.
20. **Evaluate chunking strategies.** Chunk size and overlap materially affect retrieval
    quality and were set heuristically.

### 6.6.2 Grounding quality and safety

21. **Adversarial prompt-injection testing.** Authorisation-first retrieval mitigates the
    vector described by Greshake et al. (2023), but retrieved text is still presented to a
    model. An explicit test suite of injected documents is warranted.
22. **Measure refusal accuracy.** Test the system's behaviour on questions the corpus
    genuinely cannot answer. The `low` confidence path exists; whether it triggers
    correctly is unmeasured.
23. **Add claim-level citation verification in the runtime** — check that each cited chunk
    actually supports the claim attached to it, rather than merely being the nearest
    passage. The offline evaluation (§5.5.1) already decomposes answers into supported and
    unsupported claims; the recommendation is to move that check into the live path.

### 6.6.3 Corpus and language

24. **Add OCR** so scanned documents are ingestible. Currently excluded as a stated
    limitation, and a common case for older university archives.
25. **Multilingual support**, beginning with Nigerian institutional languages. The entire
    interface, corpus and output path is English-only.
26. **Speech-to-text ingestion** for recorded lectures — excluded from this study's scope
    and the next-largest corpus gap after OCR.
27. **Cross-institution federated retrieval** for public material such as past-question
    papers, with the isolation model preserved by separating public from tenant-private
    corpora at the retrieval layer rather than by weakening the policies.

### 6.6.4 Learning and evaluation

28. **Complete the longitudinal study** — the most valuable extension of this work. Record
    cohort quiz performance before and after sustained use to test whether grounded
    retrieval plus spaced planning actually improves outcomes. This would convert the study
    from a systems result into an educational-effectiveness result, which is the question
    the system exists to answer.
29. **Adaptive sequencing.** Concept-confusion signals are already computed; feeding them
    into automatically recommended study order would implement the adaptive systems
    Brusilovsky and Peylo (2003) review, at a content scale the field's earlier
    overreaches suggest is now feasible.
30. **Complete the usability study** and, once available, report SUS results against the
    bands in [Table 5.4](CHAPTER_5_RESULTS_AND_DISCUSSION.md#573-analysis-tables--awaiting-data-collection).
31. **Replace the answer-quality LLM judge with human raters.** The evaluation in
    [§5.5.1](CHAPTER_5_RESULTS_AND_DISCUSSION.md#551-measured-answer-quality-llm-judge)
    shows grounding measurably changes answer behaviour, but its κ is inter-*judge*, not
    inter-*rater*. A small human-rated subset would yield a human-reliability figure and
    calibrate the automated judge.

---

## 6.7 Conclusion

A student who asks AcademiAI a question about their course material receives an answer
composed from passages they are entitled to read, with each claim pointing to the specific
passage that supports it — and when their material does not answer the question, the
system says so. A lecturer receives cohort signals showing which concepts the cohort has
misunderstood. An administrator configures their institution without writing code, and can
show who did what. A platform operator provisions a new university from a public request
form.

The isolation requirement is met by the database rather than by application discipline,
which is the difference between a guarantee and a convention. Where the system does not
yet work, this report says so: four High-severity defects, three failing tests, two
unreachable features, an unmeasured retrieval-*ranking* claim and an unadministered
questionnaire.

That second list is the more useful output. A final-year report that claims only success
teaches its reader nothing about whether the system can be relied upon; a report that
states exactly which parts are verified, which are not, and how to reproduce the
verification is a working artifact. The defect register and the evidence file are supplied
for that purpose.

---

**Next:** [Appendix](APPENDIX.md)

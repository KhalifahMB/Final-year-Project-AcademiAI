# Chapter Two — Literature Review

---

## 2.1 Introduction

This chapter reviews the body of knowledge that AcademiAI draws on and positions the
system against it. The review is organised around the four problems the system must
solve simultaneously: producing an answer that is grounded in a specific corpus,
retrieving that corpus well, isolating that corpus between competing institutions, and
supporting the study workflow that follows from the answer.

Each section reviews a domain, identifies what that domain contributes, and states the
specific limitation that motivated a design decision in this project. The review
concludes with a table of previously published work, the technologies considered and
rejected, and the justification for the database platform actually used.

**A note on sourcing.** Every work cited in this chapter was verified against its
publisher record or author preprint during preparation of this report. Where a field
could not be confirmed from the primary record, the entry says so explicitly rather than
supplying a plausible value. Section 2.9 lists the full references.

---

## 2.2 Domain Review

### 2.2.1 Large language models and the hallucination problem

A large language model (LLM) is a neural network trained on very large corpora of text to
predict tokens, and thereby acquires broad statistical competence in language
(Devlin et al., 2019; Vaswani et al., 2017). Modern instruction-tuned models are
additionally aligned to follow instructions, which is what makes them usable as
conversational assistants.

Their central weakness for academic use is that they generate plausible text rather than
retrieve verified fact. A model asked to explain a theorem it has never been given will
produce a fluent explanation, and the fluency is indistinguishable from correctness. Gao
et al. (2023) identify hallucination, outdated knowledge and non-transparent reasoning as
the three limitations that motivate the entire retrieval-augmented family of techniques.

For a student, this failure is not merely inconvenient. An invented definition of a
concept, delivered confidently, is indistinguishable from the real one and may be
internalised. The literature is unambiguous that grounding is the necessary response; the
open question this project addresses is *whose* corpus grounds the answer.

### 2.2.2 Retrieval-augmented generation

Retrieval-augmented generation (RAG) couples a retriever with a generator: passages are
retrieved from an explicit index and placed in the model's context, and the model is
instructed to answer from them (Lewis et al., 2020). Lewis et al. report setting
state-of-the-art results on three open-domain question-answering tasks and generating
"more specific, diverse and factual" language than a comparable parametric-only model.

Three properties of this approach are decisive for an academic system:

1. **Falsifiability.** Because the answer derives from retrieved passages, a user can open
   the passage and check the claim. This is the property academic users need and that pure
   generation cannot offer.
2. **Currency.** Knowledge lives in the index, not in model weights, so updating the corpus
   requires re-indexing documents rather than retraining a model.
3. **Provenance.** Each retrieved passage retains an identity, which makes per-document
   authorisation enforceable *before* the model sees it.

Gao et al. (2023) organise RAG into three generations. **Naive RAG** follows
index → retrieve top-*k* → generate. **Advanced RAG** adds query rewriting, reranking and
post-processing. **Modular RAG** makes routing, tool use and verification explicit
modules. AcademiAI implements an Advanced RAG pipeline with a modular authorisation stage
that Gao et al. do not treat as a first-class component, because their framing assumes
the index is already permitted for the requester.

**Limitation of the standard formulation.** RAG as published treats the retrieved index
as a function of the *topic*, not of the *user*. Every user querying the same corpus
receives the same passages. This is acceptable for Wikipedia and wrong for a university,
where the same topic exists at different levels of confidentiality in different
departments. This project treats authorisation as a stage in the retrieval pipeline rather
than as a concern of the surrounding application (§2.2.6).

### 2.2.3 Information retrieval: dense, sparse and hybrid

**Sparse retrieval.** Lexical methods rank documents by term overlap. BM25
(Robertson & Zaragoza, 2009) remains the strongest purely lexical ranking function and
its exact-match behaviour on rare technical terms — course codes, formulae, named
theorems — is difficult for dense methods to reproduce.

**Dense retrieval.** Sentence embeddings map text into a vector space such that semantic
similarity becomes geometric proximity (Reimers & Gurevych, 2019). This handles
vocabulary mismatch: "mitosis versus meiosis" retrieves documents about "cell division
differences". Dense passage retrieval (Karpukhin et al., 2020) demonstrated that a
bi-encoder trained on question–passage pairs substantially outperforms BM25 on
open-domain question answering.

**Approximate nearest-neighbour search.** Exact nearest-neighbour search is linear in the
index size, which is unacceptable for a corpus expected to grow. Hierarchical Navigable
Small World graphs (Malkov & Yashunin, 2020) provide logarithmic-time search with
recall close to exact search, and are the indexing strategy behind `pgvector`'s `hnsw`
index type.

**Why one strategy is insufficient.** The two families fail in opposite directions. Dense
retrieval misses exact identifiers — a student searching for `CS301` or `Nigerian
Enterprise` may get nothing despite a perfect lexical match. Lexical retrieval misses
paraphrase — as described above, no amount of term overlap connects "mitosis versus
meiosis" to "cell division differences".

**Rank fusion.** Rather than attempting a single model that is good at both, the
information retrieval literature proposes fusing ranked lists. Reciprocal Rank Fusion
(RRF) scores a document by the sum, over all result lists, of `1 / (k + rank)`, with
`k = 60` (Cormack et al., 2009). The formula deliberately ignores the scores themselves
and uses only ranks, so it can fuse heterogeneous retrievers — dense and lexical
alike — without calibration. Cormack et al. report RRF outperforming Condorcet Fuse,
CombMNZ and the best individual system by 4–5% on average across TREC collections, with
statistically significant margins.

**Adopted.** AcademiAI retrieves with pgvector cosine similarity over embeddings, with
BM25 lexical scoring, and with a concept-graph traversal, then fuses all three ranked
lists with RRF at `k = 60`. The choice of `k = 60` follows Cormack et al. directly.

### 2.2.4 Concept graphs for domain structure

The retrieval strategies in §2.2.3 all treat documents as independent. An academic corpus
has latent structure: *mitosis* and *meiosis* are two instances of *cell division*;
*photosynthesis* and *respiration* are complementary processes within the same metabolic
system. A student who retrieves a passage on meiosis should also be offered the
passage that defines cell division, even where the two passages share no terms.

This is the motivation for a concept graph: nodes are concepts extracted from the corpus,
and edges are typed relations between them. Retrieval can then expand along edges from
concept matches, recovering the structural neighbours that term matching misses. The cost
is a second ranking signal to fuse, and extraction quality becomes a dependency.

**Adopted, with a caveat.** AcademiAI extracts concepts and edges during ingestion and
uses graph traversal as a third ranking signal. The extraction step is model-assisted and
heuristic, so graph-derived rankings are only as reliable as that extraction. This
limitation is carried forward into the study's stated limitations rather than being
asserted away.

### 2.2.5 Multi-tenancy and data isolation

Serving many institutions from one application is the defining constraint of Software-as-
a-Service. Guo et al. (2007) survey approaches to native multi-tenancy and identify the
core architectural concerns: data isolation, tenant-aware configuration, per-tenant
customisation and quality-of-service management. Their framework frames multi-tenancy as
an application-design problem.

Database-level support arrived with PostgreSQL row-level security (RLS), which allows a
table's rows to be filtered by a policy evaluated in the database, and — critically — which
applies to **every** client, including one issuing raw SQL. This is the property that
distinguishes it from application-layer filtering alone.

The literature is clear that application-layer filtering is insufficient as a sole
defence: a single forgotten `.filter()` in one view is a cross-tenant breach, and such
omissions are not detectable by testing the paths that work. Guo et al. explicitly note
that a single code version serves all tenants precisely because the platform absorbs the
variation, and this shared-code property is what makes per-query forgetting dangerous.

**Adopted.** AcademiAI uses the shared-schema pattern with three stacked controls:
PostgreSQL RLS as the authoritative boundary, a `TenantScopedModel` queryset default as
the ergonomic default, and DRF object permissions as the semantic layer. RLS is applied
automatically by a `post_migrate` receiver over **45 tenant-scoped tables**
([EVIDENCE §3](EVIDENCE.md#3-postgresql-row-level-security)). The application database
role is deliberately created as a non-superuser without `BYPASSRLS`, so a bug in
application code cannot escalate past the policy. This last point is the one that converts
RLS from a convention into an enforcement mechanism.

### 2.2.6 Grounding retrieval in an authorisation model

Synthesising §2.2.2 and §2.2.5 produces the requirement that distinguishes this system: the
retrieved set must be a function of the requester's entitlements, and this filtering must
occur *before* ranking, so that unauthorised content can never reach the generator or the
ranker.

This is not merely an application concern. Greshake et al. (2023) demonstrate indirect
prompt injection: because LLM-integrated applications blur the boundary between data and
instructions, an adversary who can place text in a document likely to be retrieved can
influence the model without ever interacting with it. Their taxonomy includes data theft
and information-ecosystem contamination, and they report practical attacks against
consumer systems. The OWASP Top 10 for LLM Applications accordingly ranks prompt
injection as the leading LLM application risk.

The implication for this project is concrete. A system that retrieves *before* it
authorises has two exposures: it may answer from documents the requester should not see,
and it may let a document the requester *can* see carry instructions into the model. Both
are avoided only if the authorised document set is computed first and passed to the
retriever as a filter.

**Adopted.** Every retrieval is scoped by the requester's entitlements before ranking:
resource visibility derives from the institutional hierarchy, course offerings scope
lecturer access, and RLS guarantees the scoping itself cannot be bypassed. Source
citations carry the identity of the retrieved chunk, so a claim can be traced to the
exact passage that supports it, or reported as unsupported.

### 2.2.7 Intelligent tutoring, spaced practice and mastery

Answers do not constitute learning. The instructional literature distinguishes *acquiring*
information from *retaining* it, and identifies two interventions with strong empirical
support:

- **Retrieval practice.** Requiring recall of material, rather than restudying it,
  produces substantially better long-term retention than restudy alone (Roediger &
  Karpicke, 2006).
- **Spacing and distributed practice.** Spacing study sessions over time outperforms
  massing them, across a wide range of materials and retention intervals (Cepeda et al.,
  2006).
- **Mastery learning.** Instruction sequenced so that a learner does not advance until a
  defined standard is met substantially outperforms conventional instruction in the
  large majority of the comparisons Kulik et al. (1990) synthesised.
- **Adaptive systems.** Brusilovsky and Peylo (2003) review adaptive learning technologies
  spanning intelligent tutoring systems, adaptive presentation and adaptive sequencing.

Brusilovsky and Peylo also note the long history of adaptive systems whose ambitions
exceeded what content could support — a caution that recurs in this project's own
limitations.

**Adopted.** AcademiAI implements the mechanisms rather than the adaptation: a study
planner with dated milestones and tasks, a calendar that merges lectures, exams and
personal study blocks so that spacing can be planned, quizzes that record per-question
mastery, and a "explain the wrong answer" affordance that converts an error into
retrieval practice. Concept-confusion signals derived from both what students ask and
where they answer incorrectly give the lecturer the input that adaptive sequencing would
require.

### 2.2.8 Usability measurement

A system used by students under exam pressure fails if it is unpleasant, regardless of its
retrieval quality. The System Usability Scale (SUS) (Brooke, 1996) is the standard
instrument: ten Likert items producing a single 0–100 score. Bangor, Kortum and Miller
(2008) analysed nearly a decade of SUS data across many products, establishing the
normative distribution, the bimodal shape of the scale, and adjective-rating bands that
make an individual score interpretable.

**Adopted.** The [Appendix](APPENDIX.md) specifies the full SUS instrument, its scoring
procedure with the odd/even item inversion, the interpretive bands from Bangor et al., a
sampling plan stratified by role, and blank analysis tables. No responses have been
collected, and no usability score is reported anywhere in this document.

---

## 2.3 Review of Previously Published Work

The table below records the primary published work the design draws on. The **Funding /
Support** column reports only what the publication's front matter states; where a paper
declares no funding, this is recorded as *"Not stated in publication"* rather than
guessed. The **Findings / Limitation** column reports the outcome the authors state, and
the limitation this project inherits from that work.

| S/No | Author(s) & Year | Title | Method / Technique | Funding / Support | Findings / Limitation |
|---|---|---|---|---|---|
| 1 | Lewis et al. (2020) | Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks | RAG: dense retriever + seq2seq generator, RAG-Sequence and RAG-Token variants | Not stated in publication (industry & academic affiliation) | State of the art on three open-domain QA tasks; generated language more specific, diverse and factual than parametric-only seq2seq. **Limitation:** the retrieved index is topic-scoped, not user-scoped |
| 2 | Karpukhin et al. (2020) | Dense Passage Retrieval for Open-Domain Question Answering | Bi-encoder trained on question–passage pairs, MIPS over Wikipedia | Not stated in publication (academic) | Dense retrieval substantially outperforms BM25 on open-domain QA. **Limitation:** requires task-specific supervised training; heavy for small corpora |
| 3 | Robertson & Zaragoza (2009) | The Probabilistic Relevance Framework: BM25 and Beyond | Probabilistic term-frequency saturation ranking function | Not stated in publication (industry) | Establishes BM25 as the strongest purely lexical ranker; near-linear, mature, zero training cost. **Limitation:** no semantic matching; fails under vocabulary mismatch |
| 4 | Cormack et al. (2009) | Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods | Rank-only fusion, score(d) = Σ 1/(k + rank), k = 60 | Not stated in publication (academic & industry) | RRF beats Condorcet Fuse, CombMNZ and the best individual system by 4–5% on average on TREC, significant by sign test. **Limitation:** uses ranks only, discarding score magnitude |
| 5 | Gao et al. (2023) | Retrieval-Augmented Generation for Large Language Models: A Survey | Taxonomy into Naive, Advanced and Modular RAG; retriever/generator/augmentation analysis | Not stated in publication (academic) | Formalises three RAG generations and the known failure modes. **Limitation:** treats the index as already authorised; does not address multi-tenant entitlement |
| 6 | Greshake et al. (2023) | Not What You've Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection | Indirect prompt injection taxonomy; attacks on Bing Chat and synthetic GPT-4 applications | Not stated in publication (academic & industry) | Retrieved text can act as arbitrary code execution, enabling data theft and ecosystem contamination. **Limitation:** no effective mitigation is proposed; defence is open |
| 7 | Malkov & Yashunin (2020) | Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs | Hierarchical navigable small-world (HNSW) graph index | Not stated in publication (industry) | Logarithmic-time search with high recall; underpins pgvector's `hnsw` index. **Limitation:** memory-heavy; recall trades against build cost and RAM |
| 8 | Reimers & Gurevych (2019) | Sentence-BERT: Sentence Embeddings Using Siamese BERT-Networks | Siamese/Bi-encoder fine-tuning for sentence-level embeddings | Not stated in publication (academic) | Produces sentence embeddings that outperform prior BERT baselines on STS and classification. **Limitation:** trained on general web text, not academic register |
| 9 | Devlin et al. (2019) | BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding | Masked language model pre-training with next-sentence prediction | Not stated in publication (industry) | Establishes the bidirectional encoder that all subsequent embedding work builds on. **Limitation:** quadratic attention in sequence length; not a retrieval method |
| 10 | Vaswani et al. (2017) | Attention Is All You Need | Transformer encoder–decoder with self-attention | Not stated in publication (industry & academic) | Removes recurrence; parallelisable training and long-range dependency modelling. **Limitation:** quadratic in sequence length; high inference cost |
| 11 | Guo et al. (2007) | A Framework for Native Multi-Tenancy Application Development and Management | Reference architecture with multi-tenancy common services | Not stated in publication (industry) | Identifies isolation, configuration and QoS as the core multi-tenancy concerns. **Limitation:** application-layer framing; predates database-enforced RLS |
| 12 | Kulik et al. (1990) | Mastery Learning: A Review | Meta-analysis of mastery-learning experiments | Not stated in publication (academic) | Mastery learning outperforms conventional instruction in the large majority of comparisons. **Limitation:** requires reliable per-learner assessment to sequence instruction, which is rarely available |
| 13 | Cepeda et al. (2006) | Distributed Practice in Verbal Recall Tasks: A Review and Quantitative Synthesis | Meta-analysis of spacing effects | Not stated in publication (academic) | Spacing beats massing across retention intervals and materials. **Limitation:** lab-based; optimal gaps are not directly transferable to a curriculum timetable |
| 14 | Roediger & Karpicke (2006) | Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention | Retrieval-practice experiments (SFT, prose passage) | Not stated in publication (academic) | Repeated retrieval outperforms repeated study for long-term retention. **Limitation:** short laboratory passages; effect sizes attenuate with longer delays and material |
| 15 | Brusilovsky & Peylo (2003) | Adaptive Learning Technologies | Survey of ITS, adaptive presentation, adaptive sequencing | Not stated in publication (academic) | Maps the adaptive-learning design space. **Limitation:** documents repeated overreach of adaptive systems relative to available content |
| 16 | Brooke (1996) | SUS: A Quick and Dirty Usability Scale | Ten-item Likert instrument, 0–100 score | Not stated in publication (academic) | Validated, widely adopted usability instrument. **Limitation:** measures perceived usability, not task success or learning outcome |
| 17 | Bangor, Kortum & Miller (2008) | An Empirical Evaluation of the System Usability Scale | Analysis of ~10 years of SUS data across many products | Not stated in publication (industry & academic) | Establishes normative distribution, bimodality and adjective-rating bands. **Limitation:** normative means come from general (non-specialty) software |

### 2.3.1 Comparison of commercial and academic products

The system is also positioned against products a student could plausibly use instead.
This comparison is drawn from the project's own competitive analysis in
`docs/PRODUCT_ROADMAP.md` and from product documentation; these are commercial artefacts,
not peer-reviewed results.

| Product | Grounding source | Institutional isolation | Academic structure | Study workflow | Citations |
|---|---|---|---|---|---|
| **AcademiAI** | Tenant-uploaded corpus only | PostgreSQL RLS, per course offering | Faculty → dept → programme → course → offering | Planner, 4-view calendar, quizzes, notes, progress | Per-chunk, always |
| NotebookLM | User-supplied sources | Single user, no institutional model | None | Notes, mind maps, audio overviews | Yes |
| General AI assistants | Model parameters, optionally web search | None | None | Limited | Often absent or unverifiable |
| Anki / RemNote | User-supplied notes | Single user | None | Spaced repetition, notes | Not applicable |
| Conventional LMS | Own file repository | Institutional | Yes | Assignment submission, gradebook | Not applicable |

The distinction is the second and third columns. Competitors either ground on a shared
public corpus or a single user's private notes; none models the institutional hierarchy
at course-offering granularity, and none enforces per-tenant isolation at the database
layer.

---

## 2.4 Review of Languages, Frameworks and Tools

### 2.4.1 Programming languages

| Language | Where used | Justification |
|---|---|---|
| **Python 3.13** | Backend, Celery tasks, ingestion and retrieval pipeline, test suite | The dominant language for retrieval and NLP. `sentence-transformers`, `pgvector`, the RAG libraries and the Django ecosystem are Python-native, so the retrieval logic — the research-critical part — is written in the language with the deepest tooling. |
| **JavaScript (ES2022+)** | Frontend application code, build configuration, automated capture and QA scripts | Required by React; also the language of the Playwright verification scripts used to produce Chapter 5's screenshots. |
| **SQL (PostgreSQL)** | RLS policies, tenant-scoped views, full-text lexical search, aggregation in analytics | RLS policies cannot be expressed in application code, so a first-class SQL layer is a design requirement rather than a convenience. |
| **CSS (Tailwind v4, CSS-first)** | Design tokens and layout | Tokens live as CSS custom properties so light and dark themes derive from one source without duplicated class names. |

**Python is the only language used for both the backend and the AI pipeline**, which
removes a cross-language boundary from the retrieval path.

### 2.4.2 Backend framework

**Django 6.1.1** with **Django REST Framework**. Django supplies the ORM, migrations,
admin, the app registry that RLS derivation introspects, and the test client. Its mature
migration framework gives a reliable, ordered schema history — 77 migration files in this
project — which is what makes the physical database design in Chapter 4 derivable from
source rather than from a separate diagram.

DRF supplies serializer-based validation, class-based viewsets (36 registered across 13
routers), token authentication and object-level permissions. The decision to use DRF
viewsets over plain Django views is what makes 235 HTTP operations expressible as a
consistent resource hierarchy.

### 2.4.3 Frontend framework

**React 19** with **Vite 8**. All 57 page components are lazily imported through
`frontend/src/routes/pages.js`, so a student never downloads the platform console or the
quiz editor. The production build confirms the effect: the largest chunks are named by
route (`NotesPage`, `DashboardPage`), not by a monolithic bundle.

The backend is an Axios client with JWT bearer tokens and a cookie fallback, so the API
is consumable by non-browser clients.

### 2.4.4 Retrieval and generation services

| Service | Purpose |
|---|---|
| `pgvector` (PostgreSQL 16) | Vector storage and cosine-similarity search, with `hnsw` for approximate nearest-neighbour search |
| PostgreSQL full-text search | Sparse lexical ranking, fused with the dense results |
| **Gemini** | Answer generation from the retrieved, authorised passages |
| Sentence embedding model | Produces the vectors indexed by `pgvector` |

Inference is delegated to a hosted provider. The consequence — that answer quality depends
on an external service the project does not control — is recorded as a study limitation in
[Chapter 1 §1.4](CHAPTER_1_INTRODUCTION.md#14-scope-and-delimitation-of-the-study).

### 2.4.5 Asynchronous processing and object storage

| Component | Purpose |
|---|---|
| **Celery** | Asynchronous document processing: text extraction, chunking, embedding, concept extraction |
| **RabbitMQ** | Broker |
| **Redis** | Cache and Celery result backend |
| **MinIO** | S3-compatible object storage for uploaded documents, with signed preview URLs |
| **Server-Sent Events** | Streams generation tokens and processing results to the browser |

Processing is asynchronous because embedding a document is slow enough that a synchronous
upload would hold an HTTP request open. Eleven Celery tasks are defined and routed across
five queues — `celery`, `ai`, `ingestion`, `email` and a dead-letter queue — by
`CELERY_TASK_ROUTES` in `backend/config/settings.py` and the queue declarations in
`backend/config/celery.py`.

---

## 2.5 Database Management System

### 2.5.1 Requirement

The database must satisfy five requirements, of which the first is decisive:

1. **Row-level security.** It must support policies enforced by the database on every
   query, regardless of which client issues it.
2. **Vector similarity search** at corpus scale, with an approximate nearest-neighbour
   index.
3. **Full-text lexical search** for sparse retrieval.
4. **Transactional relational modelling** across 61 tables with substantial referential
   integrity.
5. **One transactional store** for all of the above, so that ingesting a document and
   making it retrievable is atomic.

### 2.5.2 Options considered

| Option | RLS | Vector search | Full text | Relational | Assessment |
|---|---|---|---|---|---|
| **PostgreSQL 16 + pgvector** | Native `ROW LEVEL SECURITY` with `FORCE` | Native via pgvector, `hnsw` supported | Native `tsvector` | Full | **Selected** |
| MySQL 8 | No row-level security | No native vector type | Native | Full | Rejected — fails R1 outright |
| MS Access | No | No | Limited | Full | Rejected — fails R1, R2, R3 and R5 |
| MongoDB | No | Atlas Vector Search | Native | Weak referential integrity | Rejected — fails R1 and R4 |
| SQLite | No | Extension-dependent | `FTS5` | Full | Rejected — fails R1 and R2 |
| PostgreSQL + separate vector DB | Native | Yes, in Qdrant/Milvus | Native | Full | Rejected — splits the atomicity required by R5 |
| PostgreSQL + pgvector as a dedicated service | Native | Yes | Native | Full | Rejected — an extra service to operate, for no benefit at this scale |

### 2.5.3 Justification for the selected DBMS

**The template names MySQL or MS Access as the database for this project. Neither was
used, and neither could satisfy the isolation requirement.** This is a deliberate
departure from the template, documented here rather than concealed:

- MySQL has no row-level security facility. Tenant isolation would therefore rest
  entirely on application code — precisely the single point of failure this project
  exists to eliminate. An institution evaluating this system would be asked to trust that
  no query anywhere omits a filter.
- MS Access has no vector search, no row-level security, and no multi-user deployment
  story. It is unsuitable for a networked application.

**PostgreSQL 16 with pgvector satisfies all five requirements in one engine:**

1. **Row-level security** is native, supports `FORCE ROW LEVEL SECURITY` so that even the
   table owner is subject to policy, and is evaluated per query by the engine. Policies in
   this project are derived automatically from the model registry — 45 tables — by a
   `post_migrate` receiver, so coverage cannot drift as models are added.
2. **Vector search** is provided by pgvector, and the `hnsw` index type (Malkov & Yashunin,
   2020) for approximate nearest-neighbour search is available. *What the engine offers and
   what a schema defines are not automatically the same* — which was exactly the finding
   behind [D16](DEFECTS.md#d16--retrieval-runs-sequentially-with-no-vector-or-full-text-index-medium):
   no `hnsw` index was defined on `resource_chunks.embedding`, so the project ran exact
   cosine search. A partial `hnsw (embedding vector_cosine_ops)` index has since been
   added, closing the gap between capability and schema.
3. **Full-text search** is native and supports the lexical half of hybrid retrieval. The
   same defect applied here — the schema had no stored `tsvector` column and no `GIN`
   index, so `ts_rank` was computed per row at query time. It now stores a generated
   `tsvector` with a `GIN` index behind it. The measured query plans, including the
   planner's behaviour with the row-level security predicate present, are in
   [EVIDENCE §3.1](EVIDENCE.md#31-index-inventory).
4. **Relational modelling** is complete: 61 concrete models, 77 migrations, with
   foreign keys across the institutional hierarchy.
5. **Atomicity** holds because a document's text, chunks, embeddings, concepts and edges
   all commit together with its metadata.

The container runs `pgvector/pgvector:pg16`. The application role is created as a
**non-superuser without `BYPASSRLS`**, which is what makes the RLS policies binding rather
than advisory; a separate superuser exists only to bootstrap the schema
([EVIDENCE §3](EVIDENCE.md#3-postgresql-row-level-security)).

The operational cost of this decision is stated honestly: PostgreSQL has a higher
provisioning cost than MySQL or Access, and this project consequently depends on Docker
Compose for a reproducible environment.

---

## 2.6 Security Considerations from the Literature

The literature reviewed above yields four design constraints, each adopted:

| Threat | Literature | Control adopted |
|---|---|---|
| Cross-tenant data leakage | Guo et al. (2007) | PostgreSQL RLS as the authoritative boundary; non-`BYPASSRLS` app role; 45 tables policy-derived from the model registry |
| Hallucinated answer | Lewis et al. (2020); Gao et al. (2023) | Generation restricted to retrieved passages; explicit refusal when the corpus does not support an answer; per-chunk citations |
| Indirect prompt injection via retrieved documents | Greshake et al. (2023) | Authorised document set computed **before** retrieval; retrieved text treated as content, not instructions; tool calls surfaced for inspection |
| Unauthorised access to confidential material | Guo et al. (2007) | Visibility derived from the institutional hierarchy; lecturers scoped to assigned course offerings; unauthorised identifiers return 404 rather than 403 so existence is not disclosed |

The last row is a deliberate choice with a user-visible consequence: a student who guesses
a valid resource UUID belonging to another course receives a 404, not a 403. This was
observed during verification and is reported in
[Chapter 5 §5.3](CHAPTER_5_RESULTS_AND_DISCUSSION.md#532-tenant-isolation-verified-at-runtime).

---

## 2.7 Summary of the Review

The literature establishes that retrieval-augmented generation answers the hallucination
problem, that hybrid retrieval with rank fusion outperforms any single retriever
(Cormack et al., 2009), and that multi-tenancy requires isolation enforced below the
application layer (Guo et al., 2007). It does not address the combination this project
requires: **retrieval filtered by institutional entitlement at course-offering
granularity, enforced by the database**.

The instructional literature (Kulik et al., 1990; Cepeda et al., 2006; Roediger &
Karpicke, 2006) establishes that answers must be followed by retrieval practice and
spacing for learning to occur, which is why a study planner and calendar are in scope
rather than deferred. The security literature (Greshake et al., 2023) establishes that
retrieved content is an attack surface, which is why authorisation precedes retrieval.

The gaps this project addresses are therefore: a retrieval pipeline in which the candidate
set is a function of the requester's institutional entitlements; and a workflow that
carries an answer through to dated, assessable study activity.

---

## 2.8 References

1. Bangor, A., Kortum, P. T., & Miller, J. T. (2008). An empirical evaluation of the System Usability Scale. *International Journal of Human–Computer Interaction*, 24(6), 574–594. https://doi.org/10.1080/10447310802205776
2. Brooke, J. (1996). SUS: A quick and dirty usability scale. In *Usability Evaluation in Industry* (pp. 189–193). ACM.
3. Brusilovsky, P., & Peylo, C. (2003). Adaptive learning technologies. *Education and Information Technologies*, 8(1), 7–33.
4. Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380.
5. Cormack, G. V., Clarke, C. L. A., & Buettcher, S. (2009). Reciprocal rank fusion outperforms Condorcet and individual rank learning methods. In *Proceedings of SIGIR '09* (pp. 758–759). ACM. https://doi.org/10.1145/1571941.1572114
6. Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of deep bidirectional transformers for language understanding. In *Proceedings of NAACL-HLT* (pp. 4171–4186).
7. Gao, Y., Xiong, Y., Gao, X., Jia, K., Pan, J., Bi, Y., Dai, Y., Sun, J., Guo, Q., Wang, M., & Wang, H. (2023). Retrieval-augmented generation for large language models: A survey. *arXiv:2312.10997*. https://doi.org/10.48550/arXiv.2312.10997
8. Gemini Team (2023). Gemini: A family of highly capable multimodal models. *arXiv:2312.11805*.
9. Greshake, K., Abdelnabi, S., Mishra, S., Endres, C., Holz, T., & Fritz, M. (2023). Not what you've signed up for: Compromising real-world LLM-integrated applications with indirect prompt injection. In *Proceedings of AISec '23* (pp. 79–90). ACM. https://doi.org/10.1145/3605764.3623985
10. Guo, C. J., Sun, W., Huang, Y., Wang, Z. H., & Gao, B. (2007). A framework for native multi-tenancy application development and management. In *Proceedings of IEEE CEC/EEE 2007* (pp. 551–558). https://doi.org/10.1109/CEC-EEE.2007.4
11. Karpukhin, V., Oguz, B., Wu, S., Edunov, S., Chen, D., & Yih, W.-T. (2020). Dense passage retrieval for open-domain question answering. In *Proceedings of EMNLP 2020* (pp. 6769–6781).
12. Kulik, C. C., Kulik, J. A., & Juma, J. J. (1990). Mastery learning: A review. *Review of Educational Research*, 60(2), 265–299.
13. Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W.-T., Rocktäschel, T., & Riedel, S. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. In *Advances in Neural Information Processing Systems 33 (NeurIPS 2020)*. https://doi.org/10.48550/arXiv.2005.11401
14. Malkov, Y., & Yashunin, D. A. (2020). Efficient and robust approximate nearest neighbor search using hierarchical navigable small world graphs. *IEEE Transactions on Pattern Analysis and Machine Intelligence*, 42(4), 824–836.
15. Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence embeddings using siamese BERT-networks. In *Proceedings of EMNLP-IJCNLP 2019* (pp. 3982–3992).
16. Robertson, S., & Zaragoza, H. (2009). The probabilistic relevance framework: BM25 and beyond. *Foundations and Trends in Information Retrieval*, 3(4), 333–389.
17. Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*, 17(3), 249–255.
18. Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is all you need. In *Advances in Neural Information Processing Systems 30 (NeurIPS 2017)*.

---

**Next:** [Chapter Three — Methodology](CHAPTER_3_METHODOLOGY.md)

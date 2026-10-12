# Chapter One — Introduction

---

## 1.1 Background of the Study

Higher education in Nigeria, as elsewhere, is delivered through institutions that have
accumulated a great deal of academic material and very little means of making it usable.
A single federal university of the kind this project targets will, in the ordinary course
of a few years, hold lecture notes, lecture hand-outs, past-question papers, assignment
briefs, reading lists and revision guides across every department it operates. That
material exists. What it lacks is a retrieval surface.

Students locate required material through a mixture of asking classmates in messaging
groups, searching personal drives that were synchronised years earlier, guessing at file
names on a learning management system, and physically attending a lecturer to ask a
question that was almost certainly answered in the hand-out distributed in week three.
Each of these routes is slow, and each fails differently. A peer answer may be wrong.
A personal drive may be two generations out of date. A file name may be
`lecture 3 FINAL (2).pdf`. A lecturer may simply not be available.

Large language models appeared into this environment and were immediately attractive for
exactly the wrong reasons. They will answer any question, in fluent prose, in seconds, and
they will do so whether or not they have any basis for the answer. A student who asks for
a summary of the lecturer's treatment of Bayesian estimation and receives a confident
paragraph of invented mathematics has been harmed, not helped — and has no way to tell,
because the output reads exactly like the correct answer does.

The technical response to fabricated answers is **retrieval-augmented generation**, in
which a model is supplied with retrieved passages and instructed to answer from them
(Lewis et al., 2020). This is a large improvement on pure generation, but on its own it
does not solve the institutional problem. Given a good retriever, a model will faithfully
ground its answer in whatever passages it is given — including passages belonging to a
different department, a different course, a different faculty, or a different
university entirely. Grounding in *some* corpus is not the same as grounding in *your*
corpus.

That distinction is the whole problem. Academic material is not merely copyrighted or
private; it is *institutionally scoped*. The notes for a 300-level course in one faculty
are not a valid basis for an answer in another. Examination questions are not merely
confidential, they are embargoed until a result has been released. A student who
legitimately matriculated last year is not automatically entitled to this year's
provisional materials. Any system that answers questions over academic material must
therefore answer a question that has no purely technical answer: **on what basis is this
particular human being entitled to see this particular document?**

This project treats that as a first-class architectural requirement rather than a
feature. AcademiAI is a multi-tenant academic assistant in which each institution is an
isolated tenant, and within a tenant the institutional hierarchy — faculty, department,
programme, course, course offering — governs what a given user may retrieve. Every
retrieval is filtered by the requesting user's authorisation before it reaches the model.
The answer is grounded in the corpus *and* the corpus is grounded in the permission.

Three further problems follow from institutional fragmentation, and each is addressed by
a distinct mechanism in this system.

**Retrieval quality.** Embedding similarity alone is a weak ranker. A student asking about
"the difference between mitosis and meiosis" and one asking about "cell division
differences" share almost no vocabulary, and pure vector search will rank the second
below documents that merely repeat the word "cell". AcademiAI combines three retrieval
strategies — dense vector search, sparse lexical search and a concept graph that links
related academic topics extracted from the corpus — and fuses their ranked lists with
Reciprocal Rank Fusion.

**Fragmented workflow.** An answer that is not attached to anything is an answer that is
forgotten. AcademiAI closes the loop between understanding and doing: study plans with
dated milestones and tasks, a layered calendar that merges lectures, exams, office hours
and personal study blocks into one surface, self-assessments that record mastery, and
notes and bookmarks that persist the outcome of a conversation.

**Trust.** Academic users are, reasonably, sceptical of AI output. Every claim the system
makes is traceable to the retrieved source, with a citation the user can open and read.
Where the corpus does not support an answer, the system says so rather than filling the
gap.

### 1.1.1 The system

AcademiAI is a web application composed of a Django REST Framework backend and a React
19 single-page frontend, deployed together under Docker Compose. It contains **61 database
models**, exposes its API through **13 DRF routers registering 36 viewsets** that serve
**235 HTTP operations** across **262 distinct API URL patterns**, and enforces tenant
isolation at both the application layer and the PostgreSQL row-level security layer. It
authenticates four distinct roles — student, lecturer, tenant administrator and platform
superuser — plus a public self-service institution-request flow, and assigns each in-tenant
role a dedicated AI agent with its own tools and persona. Full measured detail is in
[EVIDENCE.md §2](EVIDENCE.md#2-backend-structural-counts).

The three in-tenant agents are distinct products sharing one retrieval substrate:

| Role | Agent | Function |
|---|---|---|
| Student | **Study Partner** | Explains course material from the corpus, plans study, generates self-tests, explains wrong answers |
| Lecturer | **Course Co-pilot** | Drafts quizzes from chosen documents, analyses cohort performance, surfaces concept confusion |
| Tenant administrator | **Institution Operator** | Explains audit activity, institutional configuration and access rules |

A platform superuser agent exists at the infrastructure layer for tenant provisioning and
system health.

---

## 1.2 Statement of the Problem

Academic resources in Nigerian universities are held in institutional silos and are
practically unsearchable by the students who need them. At the same time, general-purpose
AI assistants answer questions about these subjects fluently and without basis. The
consequences are concrete:

1. **Answers are ungrounded.** A student using a general assistant may receive an
   invented explanation that conflicts with the lecturer's actual treatment, and has no
   mechanism to detect the conflict.
2. **Institutional material is unreachable.** Because material is organised by faculty,
   department and course rather than by question, the student who needs it cannot find it
   even when it exists and they are entitled to it.
3. **Authority is unmodelled.** Existing tools treat document access as a property of a
   document rather than of a relationship between a person and a document within an
   institutional hierarchy. There is no way to express "this student is entitled to this
   course's resources, but not this one."
4. **Answering does not lead to studying.** Even a correct answer sits outside the
   student's workflow, with no route from comprehension to scheduled revision or assessed
   practice.
5. **Trust cannot be established.** Without citations, an answer is unfalsifiable, and an
   unfalsifiable answer is unusable in an academic context.

The problem can therefore be stated as a single question:

> **How can an academic institution deploy an AI assistant that answers a student's
> questions only from that student's own institutional material — enforcing who may
> retrieve what, at the level of individual course offerings — while making every answer
> traceable to its source and connecting the answer to an actionable study plan?**

---

## 1.3 Aim and Objectives of the Study

### 1.3.1 Aim

To design, implement and evaluate a multi-tenant academic AI assistant that generates
answers strictly grounded in a tenant-uploaded academic corpus, enforces institutional
access rules at the level of individual course offerings, cites its sources, and converts
the resulting understanding into tracked, scheduled and assessable study activity.

### 1.3.2 Specific objectives

The study pursues seven objectives. Each is stated as a deliverable, and each is traceable
to a chapter of this report.

| # | Objective | Demonstrated in |
|---|---|---|
| **O1** | Establish a multi-tenant data model in which each institution is an isolated tenant and no cross-tenant read is possible under any code path, including direct SQL issued by the application role. | Ch. 4 §4.7, §4.8; [EVIDENCE §3](EVIDENCE.md#3-postgresql-row-level-security) |
| **O2** | Model institutional academic structure — faculty, department, programme, course, academic session, semester, course offering — and derive resource visibility from it. | Ch. 4 §4.6, §4.7 |
| **O3** | Implement an ingestion pipeline that converts uploaded documents into embedded, chunked, concept-linked text and makes them retrievable. | Ch. 4 §4.9; Ch. 5 §5.5 |
| **O4** | Implement hybrid retrieval over that corpus — dense vector, sparse lexical and concept-graph — fused by Reciprocal Rank Fusion, with per-request authorisation filtering applied before ranking. | Ch. 4 §4.10; Ch. 5 §5.4 |
| **O5** | Deliver a conversational interface with streamed responses and visible, inspectable tool-call chains, in which every substantive claim carries a citation to an openable source. | Ch. 4 §4.11; Ch. 5 §5.3 |
| **O6** | Connect answers to action: study plans with dated milestones and tasks, a four-view layered calendar with RFC-5545 export and timetable import, notes, bookmarks, progress tracking and self-assessments. | Ch. 4 §4.12; Ch. 5 §5.6 |
| **O7** | Evaluate the system against measurable quality criteria and prepare a validated instrument for assessing its usability. | Ch. 5 §5.1, §5.2, §5.5.1, §5.7; [Appendix](APPENDIX.md) |

A supporting objective runs alongside these: to deliver role-specific administration so
that each of the four roles is operated through a purpose-built surface rather than a
generic dashboard, and to make the platform operable by an institution without developer
intervention.

---

## 1.4 Scope and Delimitation of the Study

### 1.4.1 Scope

The study covers the design, implementation and testing of a single web application.

**Included**

- A Django REST Framework backend of 61 models across 15 first-party apps, serving 235
  HTTP operations through 13 routers registering 36 viewsets.
- A React 19 single-page frontend with 57 lazily-loaded route components covering the
  public, student, lecturer, tenant-administrator and platform-superuser surfaces.
- Multi-tenancy over a shared schema, with tenant isolation enforced by PostgreSQL row
  level security, application-layer queryset scoping and DRF object permissions.
- Asynchronous document processing over Celery and RabbitMQ, with results streamed to the
  browser over Server-Sent Events.
- Object storage for uploaded documents over an S3-compatible interface (MinIO in
  development), with signed, short-lived preview URLs.
- Retrieval-augmented generation over a Gemini model, with hybrid retrieval and
  citation-linked answers.
- Study planning, a layered calendar, notes, bookmarks, progress tracking and quizzes.
- Four administrative levels: per-user, per-lecturer-course-scope, per-tenant and
  cross-tenant platform.
- Automated testing: 280 backend tests, 62 frontend unit tests, five Playwright
  end-to-end specs, and static analysis of the frontend.

**Excluded**

The following are outside the study and are not implemented.

| Excluded | Rationale |
|---|---|
| Native mobile applications | The responsive web interface is the intended mobile surface; a native client would not test the research question. |
| Real-time collaborative editing | Notes and plans are single-author artefacts in this study. |
| Video and audio transcription of lectures | Ingestion handles text-bearing documents only. |
| Payment processing and subscription billing | `Tenant.plan` is modelled but no billing provider is integrated. |
| Institutional SIS/LMS integration | Timetable data enters by CSV/XLSX import; there is no live connection to a student information system. |
| Offline or on-device inference | Inference is performed by a hosted model through the Gemini API. |
| Cross-institution knowledge sharing | The isolation model deliberately forbids it. |
| Automated essay grading of free-text student work | Only objective self-assessment is implemented. |
| A completed user study | See [Chapter 5 §5.7](CHAPTER_5_RESULTS_AND_DISCUSSION.md#57-user-study-instrument-and-status). No usability data has been collected. |

### 1.4.2 Limitations

These are constraints of the study that qualify its findings.

1. **Retrieval quality is bounded by the corpus.** The system can only answer from
   material a tenant has uploaded and successfully processed. A course whose materials are
   absent from the corpus will produce an honest miss, not an answer. Coverage is an
   institutional responsibility.
2. **Answer quality depends on an external model.** Generation is delegated to the Gemini
   API. The system controls retrieval, authorisation, citation and refusal behaviour, but
   not the model's language quality, and the system is not resilient to provider outage or
   to changes in that provider's behaviour. Answer quality was nevertheless measured with an
   automated LLM judge ([Ch. 5 §5.5.1](CHAPTER_5_RESULTS_AND_DISCUSSION.md#551-measured-answer-quality-llm-judge)),
   which shows it depends sharply on whether retrieval grounding is applied — but the scores
   are conditional on the provider's model version and are not a claim about the model itself.
3. **No user-study data has been collected.** The usability instrument in the
   [Appendix](APPENDIX.md) is complete and ready to administer, but no responses exist.
   Chapter 5 therefore reports no usability statistics; it reports the instrument, the
   sampling plan and the scoring procedure, and leaves the analysis tables blank.
4. **Not deployed to production scale.** The system has been verified on a single
   developer workstation. It has not been load-tested, penetration-tested, or operated
   under concurrent multi-tenant load, so no performance or security claims beyond
   functional verification are made.
5. **No OCR pipeline.** Scanned images embedded in documents are not read; only
   text-bearing documents are ingested.
6. **English only.** No language other than English is supported anywhere in the
   interface, the corpus or the generated output.
7. **Extraction is heuristic.** Concepts and edges are extracted by a model-assisted
   pipeline. Extraction quality therefore depends on model output and has not been
   independently measured.

---

## 1.5 Significance of the Study

### 1.5.1 To students

A student who has uploaded or been given their course corpus can ask a question in plain
language and receive an answer grounded in the lecturer's own material, with citations
they can open and check. Where the material does not support an answer, they are told
that, which is more useful than a confident fabrication. The answer can be turned
directly into a dated study task or a self-test, and the resulting mastery is recorded, so
revision is directed by demonstrated gaps rather than by a reading list.

### 1.5.2 To lecturers

Lecturers gain a drafting assistant that produces quizzes from their own documents rather
than inventing questions, a per-offering analytics surface showing engagement, quiz
performance and resource quality, and — because the system records both what students ask
and where they answer incorrectly — an early signal of which concepts the cohort has
misunderstood. Staff activity is excluded from cohort metrics, so the numbers describe
students.

### 1.5.3 To institutions

An institution obtains a working academic assistant without writing code, and obtains it
with an isolation model it can reason about: one row-level-security policy over a shared
schema means the isolation guarantee is enforced by the database rather than by
application discipline. Faculties, departments, programmes, courses and offerings are
modelled as data, so the structure is configurable by an administrator. The tenant
administrator surface covers users, structure, audit trail, request logs, access rules,
templates and health indicators. A request-to-provision flow lets an institution apply for
its own workspace.

### 1.5.4 To the field

The study contributes a worked, verifiable instance of retrieval-augmented generation
under an authorisation constraint — a combination that is usually discussed in the
retrieval literature and the access-control literature separately. It also demonstrates
that concept-graph reranking can be layered onto conventional hybrid retrieval at
acceptable cost, and it reports its own defects rather than only its successes, which
makes the artefact reusable as a reference implementation.

---

**Next:** [Chapter Two — Literature Review](CHAPTER_2_LITERATURE_REVIEW.md)

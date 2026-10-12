# AcademiAI — Final Year Project Report

Grounded, tenant-isolated academic AI for Nigerian universities. A Django REST +
React single-page application that answers questions only from a student's own
institutional corpus, and turns those answers into scheduled, assessable study work.

This directory contains the project report written against the required template
outline, plus the evidence it rests on.

---

## Chapters

| # | File | Covers |
|---|---|---|
| 1 | [CHAPTER_1_INTRODUCTION.md](CHAPTER_1_INTRODUCTION.md) | Background, problem statement, aims and objectives, scope and limitations, significance |
| 2 | [CHAPTER_2_LITERATURE_REVIEW.md](CHAPTER_2_LITERATURE_REVIEW.md) | Domain review, technologies, database choice, related work, comparison tables |
| 3 | [CHAPTER_3_METHODOLOGY.md](CHAPTER_3_METHODOLOGY.md) | Adopted methodology, system flow, development methodology, design tools, justification |
| 4 | [CHAPTER_4_ANALYSIS_AND_DESIGN.md](CHAPTER_4_ANALYSIS_AND_DESIGN.md) | Functional/non-functional requirements, users, UML diagrams, conceptual and physical database design |
| 5 | [CHAPTER_5_RESULTS_AND_DISCUSSION.md](CHAPTER_5_RESULTS_AND_DISCUSSION.md) | Test results, 62 annotated screenshots, questionnaire methodology, limitations |
| 6 | [CHAPTER_6_CONCLUSION_AND_RECOMMENDATION.md](CHAPTER_6_CONCLUSION_AND_RECOMMENDATION.md) | Summary of achievements, contribution, recommendations, future work |
| A | [APPENDIX.md](APPENDIX.md) | System Usability Scale questionnaire, sampling plan, scoring keys, glossary |

## Supporting material

| File | Purpose |
|---|---|
| [EVIDENCE.md](EVIDENCE.md) | Every measured figure: commands, counts, test output, health checks, seed data |
| [DEFECTS.md](DEFECTS.md) | 16 verified defects with reproduction steps, causes and fixes |
| [ANSWER_EVALUATION.md](ANSWER_EVALUATION.md) | Answer-quality evaluation (LLM-as-judge) with a grounded vs ungrounded control: method, results, limitations |
| [answer_eval_results.json](answer_eval_results.json) · [answer_eval_control_ungrounded.json](answer_eval_control_ungrounded.json) | Raw per-answer artefacts for the two evaluation runs |
| [screenshots/](screenshots/) | 62 PNG captures of the running application |

## How to read this report

**Provenance rules applied throughout.** Every factual claim about the system is traceable
to source code, a migration, a test result, or a live HTTP response recorded in
[EVIDENCE.md](EVIDENCE.md). Where the original template asked for a fact the project does
not have — a MySQL database, a completed user study, an ORM that was never used — the
report says so and explains what was done instead, rather than inventing a plausible
value. In particular:

- The database is **PostgreSQL 16 with pgvector**, not the MySQL the template names. See
  [Chapter 2 §2.5](CHAPTER_2_LITERATURE_REVIEW.md#25-database-management-system).
- **No user study has been conducted.** The questionnaire is specified, scored and ready
  to administer; its analysis tables are blank and marked as such. See
  [Chapter 5 §5.7](CHAPTER_5_RESULTS_AND_DISCUSSION.md#57-user-study-instrument-and-status)
  and the [Appendix](APPENDIX.md).
- The test suite did **not** pass cleanly at the audited revision: 277 of 280 backend tests
  passed. The three failures and fifteen other verified defects were disclosed rather than
  omitted, and a subsequent hardening pass has fixed every one of them except **D11**
  (missing tests for the `platform` and `audit` apps). See [DEFECTS.md](DEFECTS.md).
- Retrieval had **no vector or full-text index**, so both the dense and lexical signals
  were sequential scans. Found while auditing the report's own claims and recorded as
  **D16**; Chapter 4 originally stated it as an absence rather than as a design. Both
  indexes and the matching query rewrite are in place now (including the follow-up fix that
  makes the RLS tenant predicate usable by the index), and Chapter 4, Chapter 2 and the
  evidence register all report the corrected state.
- **Retrieval *ranking* is still unmeasured, but answer quality is now measured.** An
  automated LLM-as-judge evaluation — with an ungrounded control as a sanity check — scored
  the generated answers for factual correctness, relevance, groundedness and completeness
  ([Chapter 5 §5.5.1](CHAPTER_5_RESULTS_AND_DISCUSSION.md#551-measured-answer-quality-llm-judge),
  [Appendix F](APPENDIX.md#appendix-f--answer-quality-evaluation-llm-as-judge),
  [ANSWER_EVALUATION.md](ANSWER_EVALUATION.md)). The ranking that feeds those answers
  remains unmeasured, and the agreement statistic is inter-judge, not human.

## Reproducing the results

```powershell
# Backend
cd backend
docker compose up -d                 # PostgreSQL, RabbitMQ, Redis, MinIO, Mailpit
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo           # tenant + admin only
.\.venv\Scripts\python.exe manage.py seed_atbu           # 8 faculties / 43 departments / 57 programmes
.\.venv\Scripts\python.exe manage.py seed_atbu_lecturers # 8 lecturer accounts
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
npm run lint
npm test
npm run build
```

No single command builds the whole corpus. `seed_demo` creates the tenant and its
superuser; `seed_atbu` and `seed_atbu_lecturers` build the academic structure; the
resources, chunks, concepts and everything created by using the app come from operating
it. Each count in [EVIDENCE §6](EVIDENCE.md#6-seed-data-used-for-verification) names its
own origin.

See [EVIDENCE.md](EVIDENCE.md) for the exact observed output of each command.

## Seeded accounts used for the screenshots

| Role | Email | Password |
|---|---|---|
| Student | `muhammadelkufahn@gmail.com` | `Screenshot123!` |
| Lecturer | `lecturer@gmail.com` | `Screenshot123!` |
| Tenant administrator | `muhammadelkufahn27@gmail.com` | `Screenshot123!` |
| Platform superuser | `superadmin@gmail.com` | `Screenshot123!` |

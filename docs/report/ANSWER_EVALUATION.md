# Answer-Quality Evaluation (LLM-as-Judge)

**Status:** measurements complete. This document reports *measured* values, not
placeholders. It is referenced from [Chapter 5 §5.5](CHAPTER_5_RESULTS_AND_DISCUSSION.md#55-discussion-of-the-grounded-answering-result),
which previously recorded answer-quality and retrieval-quality as an unmeasured gap.

> **Read this first.** The rater here is a **Large Language Model, not a human.**
> Every "inter-rater" figure in this document is **inter-judge agreement between
> two LLM raters**, which is *not* a substitute for human inter-rater reliability
> (see [§6.5](#65-the-kappa-is-inter-judge-not-human)). The reported scores are
> model judgements; they are not human ground truth.

---

## 1. Purpose

Chapter 5 verifies that the assistant *retrieves and cites authorised material*
but explicitly states that answer quality was not measured. This evaluation closes
that gap for the **grounded-answering** behaviour: it measures, on a sample of real
student questions over the seeded ATBU corpus, how good the answers are along the
dimensions used in the project's evaluation matrix:

| Dimension | What it measures |
|---|---|
| Factual correctness | agreement with the authoritative reference passages |
| Relevance | whether the answer addresses the question asked |
| Groundedness / faithfulness | whether claims are traceable to the retrieved context |
| Completeness | whether the reference material's substance is covered |
| Hallucination rate | share of answers containing ≥ 1 unsupported claim |
| Source-attribution coverage | share of substantive claims carrying an inline `[Source N]` citation |

Plus the number of answers rated and an inter-judge agreement (Cohen's κ) score.

---

## 2. Method

### 2.1 Answer generation — the product path, not a mock

Answers are produced by the **same retrieval and generation code the chat product
uses**, so the numbers describe the shipped system:

- Retrieval: `apps.knowledge.retrieval.hybrid_retrieve()` (lexical + pgvector +
  concept, RRF-fused), `top_k = 8`, inside `tenant_scope(tenant.id)` so PostgreSQL
  RLS behaves exactly as it does in a request.
- Generation: `apps.common.ai.generate_grounded_answer()` with `SYSTEM_GROUNDING`
  and the `[SYSTEM DATA]` canary-wrapped context — i.e. the production prompt,
  including the prompt-injection framing.

### 2.2 Question set

The 60-case self-checking set built by `manage.py build_rag_testset` over the ATBU
tenant (`rag_testset_large.json`; tracked sibling `rag_testset.json`). A fixed
`--seed 2026` draws the **same 20 questions** for every condition. Each case carries
the ground-truth `relevant_chunk_ids` used as the reference ("answer key").

*Known weakness:* the questions are machine-generated from salient keywords, so some
are noisy ("What do you know about: cannot devices different icate?"). This is a
property of the auto-labelled set, not of the answers, and it is stated as a
limitation ([§6.4](#64-limitations)).

### 2.3 The judge

Each answer is scored by **two independent judge personas** on the same 1–5 rubric:

- **Judge A — "examiner":** exacting scholarly standard; penalises imprecision and
  unhedged over-claiming.
- **Judge B — "teaching assistant":** credits correct substance even when worded
  loosely; still flags wrong or unsupported statements.

Each judge returns strict JSON: four integer scores plus a per-claim decomposition
(`text`, `cited`, `supported`). From the per-claim verdicts the harness derives:

- **hallucination rate** = share of answers with ≥ 1 claim marked `supported: false`;
- **source-attribution coverage** = cited claims ÷ total claims, pooled across judges.

The judge sees the **question**, the **reference passages**, the **retrieved context
actually given to the model**, and the **candidate answer** — so groundedness is
judged against what the model saw, while factual correctness is judged against the
answer key.

### 2.4 The control condition

A rubric that awards 5/5 to everything proves nothing. The evaluation therefore also
runs an **ungrounded control** over the identical 20 questions: the model answers
from its own knowledge with **no retrieved context and no grounding instruction**. If
the rubric is sound it must score the control materially worse — above all on
groundedness and hallucination.

### 2.5 Configuration

| Item | Value |
|---|---|
| Tenant / user | `ATBU` / `muhammadelkufahn8442@gmail.com` (student) |
| Answers per condition | **20** |
| Seed | 2026 |
| Retrieval depth | `top_k = 8` |
| Judge/GEN model | `gemini-3.1-flash-lite` (pinned; see note) |
| Date of run | 2026-10-12 |

**Model note.** The configured primary `GEMINI_MODEL=gemini-3.5-flash` returned HTTP
429 (`RESOURCE_EXHAUSTED`) throughout this run, as did `gemini-3.6-flash`. The run was
therefore pinned to the healthy `gemini-3.1-flash-lite`, with the configured
fallback chain still active. This is the *same* degradation a live user would
experience on this key under the same quota, but it means the answers were generated
by a **lite** model rather than the primary, and this must be read as a limitation
([§6.4](#64-limitations)).

---

## 3. Results — grounded answering (primary)

Grounded answers, `n = 20` per judge → 40 answer-judgements, 226 claims scored.

| Dimension | Value |
|---|---|
| Factual correctness (1–5) | **4.93** |
| Relevance (1–5) | **4.98** |
| Groundedness / faithfulness (1–5) | **5.00** |
| Completeness (1–5) | **4.85** |
| Hallucination rate | **0.0 %** |
| Source-attribution coverage | **92.0 %** |
| Answers rated | **20** |
| Cohen's κ (inter-judge agreement) | **1.00** \* |

\* At ceiling — every grounded answer was labelled "acceptable" by both judges, so κ
is uninformative on its own. The control condition in [§4](#4-results--ungrounded-control)
is what demonstrates the rubric can disagree when answers are actually flawed.

Two deterministic (judge-independent) cross-checks agree with the judge:

| Deterministic check | Value |
|---|---|
| Answers containing ≥ 1 valid `[Source N]` marker | 90.0 % |
| Chunks retrieved per question | 8 (constant; `top_k`) |

---

## 4. Results — ungrounded control

Identical 20 questions, no retrieval, no grounding instruction. 221 claims scored.

| Dimension | Grounded | Ungrounded control |
|---|---|---|
| Factual correctness (1–5) | 4.93 | **3.35** |
| Relevance (1–5) | 4.98 | **4.20** |
| Groundedness / faithfulness (1–5) | 5.00 | **1.10** |
| Completeness (1–5) | 4.85 | **3.03** |
| Hallucination rate | 0.0 % | **97.5 %** |
| Source-attribution coverage | 92.0 % | **0.0 %** |
| Answers rated | 20 | 20 |
| Cohen's κ (inter-judge) | 1.00 | **0.42** |

**Interpretation.** The rubric discriminates sharply on exactly the axis it is meant
to: groundedness collapses from 5.00 to 1.10, the hallucination rate rises from 0 % to
97.5 %, and citation coverage falls from 92 % to 0 % when the corpus is removed.
Because the *same* rubric and *same* judges produced both columns, the near-perfect
grounded scores are credible rather than an artefact of a judge that simply likes
everything.

---

## 5. Inter-judge agreement (Cohen's κ)

Binarised "acceptable" (mean of the four dimensions ≥ 3.5) per answer, and per
dimension (score ≥ 4), between Judge A and Judge B:

| Comparison | Grounded | Ungrounded control |
|---|---|---|
| Overall acceptability | 1.00 | **0.42** |
| κ — factual correctness | 0.00 \* | 0.45 |
| κ — relevance | 1.00 | 0.63 |
| κ — groundedness | 1.00 | 1.00 |
| κ — completeness | 0.00 \* | 0.33 |

\* Zero despite high raw agreement: at the ceiling, almost all labels are the same
class, so expected agreement `pe` ≈ observed agreement `po` and κ is unstable
(one disagreement drives it to 0). This is the classic κ ceiling paradox and is why
the overall ceiling figure (1.00) should not be read as strong reliability evidence.
The **control column** (κ = 0.42 overall) is the informative one.

---

## 6. Discussion and limitations

### 6.1 What is supported

- On this corpus and question set, **grounded answers were rated correct, relevant,
  complete and — decisively — grounded**, with **no hallucination flagged** in 20/20
  answers and inline citations on 92 % of substantive claims.
- The evaluation **validates its own instrument** by scoring an ungrounded baseline
  far lower on groundedness (5.00 → 1.10) and far higher on hallucination (0 % →
  97.5 %).
- A judge-independent check corroborates the citation claim: 90 % of grounded answers
  contain at least one well-formed, in-range `[Source N]` marker.

### 6.2 Why the grounded scores sit at the ceiling

The reference set is *self-checking*: every question was generated **from** a chunk,
so retrieval is strong by construction and the answer key is close to the retrieved
context. The sample therefore measures "does grounding work when retrieval succeeds",
not "how good is retrieval". Retrieval *ranking* quality (recall@k, nDCG) remains a
separate, still-unmeasured question — see `evaluate_rag` and
[Chapter 5 §5.10](CHAPTER_5_RESULTS_AND_DISCUSSION.md#510-limitations-of-the-evidence).

### 6.3 Leniency / self-preference bias

The generator and the judges are from the same model family. LLM judges are known to
prefer their own family's output, so the absolute scores (especially 4.9–5.0) should
be treated as an **upper bound**. The *contrast* between conditions is the robust
finding, not the absolute level.

### 6.4 Limitations

1. **Machine-generated questions.** Some queries are keyword salad; a few grounded
   answers are legitimate abstentions ("the context does not mention…"), which judges
   score inconsistently (this is the main source of judge disagreement).
2. **Lite model.** Quota forced `gemini-3.1-flash-lite` for both generation and
   judging; results may differ under the primary model.
3. **Sample size `n = 20`** per condition — adequate for an LLM-judge pilot and to
   demonstrate discrimination, not for fine-grained inferential claims.
4. **No human raters.** See §6.5.
5. **English-only, single institution** (ATBU demo tenant), single corpus.

### 6.5 The κ is inter-*judge*, not human

Cohen's κ conventionally requires two human raters. Here both raters are automated,
from one model family, sharing one rubric. The value therefore measures **judging
consistency**, and even that is bounded by the ceiling in §6.2. It must **not** be
presented as human inter-rater reliability. A defensible human κ requires ≥ 2
independent human annotators scoring a sample of these answers; the harness output
(`answer_eval_results.json`) is structured per-answer and per-claim precisely so such
a sheet can be produced.

---

## 7. Reproduction

```powershell
cd backend
# Primary: grounded answering
.\.venv\Scripts\python.exe manage.py evaluate_answers --queries rag_testset_large.json `
    --n 20 --mode grounded --model gemini-3.1-flash-lite --seed 2026 --sleep 0.3 `
    --out ..\docs\report\answer_eval_results.json

# Control: ungrounded (no retrieval)
.\.venv\Scripts\python.exe manage.py evaluate_answers --queries rag_testset_large.json `
    --n 20 --mode ungrounded --model gemini-3.1-flash-lite --seed 2026 --sleep 0.3 `
    --out ..\docs\report\answer_eval_control_ungrounded.json
```

Requirements: Docker Postgres up and seeded (`tenants`, resources ingested and
embedded), and `GEMINI_API_KEY` set in `backend/.env`.

---

## 8. Data artifacts

| File | Contents |
|---|---|
| [`answer_eval_results.json`](answer_eval_results.json) | Grounded run — per-case answers, per-judge scores, per-claim verdicts, aggregate metrics |
| [`answer_eval_control_ungrounded.json`](answer_eval_control_ungrounded.json) | Ungrounded control run, same schema |
| `backend/apps/common/management/commands/evaluate_answers.py` | The harness |
| `backend/rag_testset_large.json` | Question set + ground-truth chunk ids (untracked) |

---

## 9. Cross-references

- [Chapter 5 §5.5 — Discussion of the Grounded-Answering Result](CHAPTER_5_RESULTS_AND_DISCUSSION.md#55-discussion-of-the-grounded-answering-result)
- [Chapter 5 §5.7 — User Study Instrument (SUS, human instrument, no data collected)](CHAPTER_5_RESULTS_AND_DISCUSSION.md#57-user-study-instrument-and-status)
- [Chapter 5 §5.10 — Limitations of the Evidence](CHAPTER_5_RESULTS_AND_DISCUSSION.md#510-limitations-of-the-evidence)

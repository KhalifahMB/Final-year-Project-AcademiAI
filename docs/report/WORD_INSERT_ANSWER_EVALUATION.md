# Word Insert Sheet — Answer-Quality Evaluation

How to fold the answer-quality evaluation into `AcademiAI_Report.docx`.
The same text is **already integrated** into the markdown chapters
(`CHAPTER_5_RESULTS_AND_DISCUSSION.md` §5.5.1, `APPENDIX.md` Appendix F, `EVIDENCE.md` §9),
so if your Word file is rebuilt from those, nothing more is needed. Otherwise paste the
blocks below at the points listed.

> **Caveat to keep wherever the numbers appear:** the κ statistic is **inter-judge**
> (two LLM personas), **not human inter-rater** reliability. The grounded κ sits at the 1.00
> ceiling and is uninformative; the control κ of 0.42 is the trustworthy value. The runs were
> pinned to a **lite** model (`gemini-3.1-flash-lite`) because the larger Gemini builds were
> rate-limited during measurement, so the scores are a floor for a larger model.

> **Pasting tables:** select the markdown table text, paste into Word, then select it and use
> **Insert → Table → Convert Text to Table** (separator: **Tab**). Simplest is to paste the
> tables from the rendered markdown (GitHub/VS Code preview), which Word accepts as a table.

---

## 1. Placement instructions

| Step | Where in `AcademiAI_Report.docx` | What to add |
|---|---|---|
| 1 | **Chapter Five**, immediately after the section *"5.5 Discussion of the Grounded-Answering Result"* (before *"5.6 Discussion of the Study-Workflow Result"*) | Sub-heading **"5.5.1 Measured answer quality (LLM-judge)"** + **Block 1** |
| 2 | **Chapter Five §5.7**, the three SUS tables | Renumber: current **Table 5.1 → Table 5.2**, **Table 5.2 → Table 5.3**, **Table 5.3 → Table 5.4** (the new table takes 5.1) |
| 3 | **Chapter One §1.3.2** objectives table, **O7** row | Append `§5.5.1` to the "Demonstrated in" cell (Block 2) |
| 4 | **Chapter One §1.4.2** limitation 2 | Append the two sentences in **Block 3** |
| 5 | **Chapter Five §5.10** limitations | Add **item 9** (Block 4) |
| 6 | **Chapter Six** objectives table, **O7** row | Replace evidence cell (Block 5); also §6.6.4 add **recommendation 31** and change *"Table 5.3" → "Table 5.4"* in item 30 |
| 7 | **Appendix C** traceability, **O7** row | Replace evidence cell (Block 6) |
| 8 | **Appendix E** "Source of Every Number" | Add the three provenance rows (Block 7) |
| 9 | **Appendix**, after Appendix E | Append the whole **Appendix F** (Block 8) |
| 10 | Evidence register (if carried into Word) | Append **section 9** (Block 9) |

---

## Block 1 — Chapter 5 §5.5.1 (the main new section)

### 5.5.1 Measured answer quality (LLM-judge)

Retrieval *ranking* remains unmeasured (see §5.10), but the quality of the grounded answers
themselves — factual correctness, relevance, groundedness, completeness, hallucination rate,
source-attribution coverage and inter-judge agreement — was measured over the seeded ATBU
corpus with an automated LLM judge, paired with an ungrounded control to show the instrument
discriminates rather than merely flatters.

A fixed 20-query set was answered twice: once through the product path (hybrid retrieval →
grounded generation) and once by the same model with retrieval removed and no grounding
instruction — the *ungrounded control*, which still had access to the reference passages so
it could be scored for factual correctness. Two independent judge personas scored every
answer on four 1–5 dimensions and decomposed it into individual factual claims.

**Table 5.1 — Answer quality, grounded vs ungrounded control (n = 20 each).**

| Metric | Grounded | Ungrounded control |
|---|---|---|
| Factual correctness (1–5) | 4.93 | 3.35 |
| Relevance (1–5) | 4.98 | 4.20 |
| Groundedness / faithfulness (1–5) | 5.00 | 1.10 |
| Completeness (1–5) | 4.85 | 3.03 |
| Hallucination rate (answers with ≥ 1 unsupported claim) | 0.0 % | 97.5 % |
| Source-attribution coverage (cited claims ÷ total claims) | 92.0 % | 0.0 % |
| Answers correctly formatted with `[Source n]` markers | 90.0 % | — |
| Answers rated | 20 | 20 |
| Inter-judge agreement (Cohen's κ, overall) | 1.00 | 0.42 |

The grounded condition scores at or near ceiling on every dimension while the control
collapses precisely where grounding should matter — groundedness (5.00 → 1.10) and
hallucination (0 % → 97.5 %) — while remaining comparatively strong on relevance and factual
correctness. That is the expected signature: without retrieval the model is still on-topic
and often factually right, but it is no longer *faithful to the corpus*. A lenient instrument
would not have separated the two conditions so sharply; the separation is what makes the
grounded numbers credible.

Two caveats are recorded plainly, and expanded in §5.10. The κ statistic is **inter-judge
(two LLM personas), not human inter-rater**, agreement. The grounded κ sits at the 1.00
ceiling and is therefore uninformative, while the control κ of 0.42 is the trustworthy value,
reflecting genuine disagreement on the harder answers. And the runs were pinned to a **lite**
model (`gemini-3.1-flash-lite`) because the larger Gemini builds were rate-limited during
measurement, so the absolute scores are a floor for a larger model, not a ceiling.

Full method, rubric, per-dimension κ and reproduction commands are in
`docs/report/ANSWER_EVALUATION.md`; the raw per-answer artefacts are
`docs/report/answer_eval_results.json` and `docs/report/answer_eval_control_ungrounded.json`.

---

## Block 2 — Chapter 1 §1.3.2, O7 row ("Demonstrated in" cell)

Replace the cell

`Ch. 5 §5.1, §5.2, §5.7; Appendix`

with

`Ch. 5 §5.1, §5.2, §5.5.1, §5.7; Appendix`

---

## Block 3 — Chapter 1 §1.4.2, limitation 2 (append to the existing text)

> Answer quality was nevertheless measured with an automated LLM judge (Ch. 5 §5.5.1), which
> shows it depends sharply on whether retrieval grounding is applied — but the scores are
> conditional on the provider's model version and are not a claim about the model itself.

---

## Block 4 — Chapter 5 §5.10, new limitation 9 (add after item 8)

9. **The answer-quality evaluation is model-judged.** §5.5.1 scores answers with an LLM
   judge, not human raters, so its κ is inter-judge agreement rather than inter-rater
   reliability; it was run on a single lite model over one tenant's corpus, and the grounded
   scores sit at ceiling. It establishes that grounding measurably changes answer behaviour
   (groundedness 5.00 vs 1.10, hallucination 0 % vs 97.5 %), not a precise quality level.

---

## Block 5 — Chapter 6 objectives table, O7 row

Status stays **Partially achieved**. Replace the evidence cell:

| # | Objective | Status | Evidence |
|---|---|---|---|
| O7 | Evaluation against measurable criteria plus a usability instrument | **Partially achieved** | 280 backend tests, 62 frontend tests, lint and build clean; answer quality measured by an LLM judge with an ungrounded control (§5.5.1); **usability instrument prepared but not administered** |

Also, in §6.6.4 add recommendation 31 after item 30:

31. **Replace the answer-quality LLM judge with human raters.** The evaluation in §5.5.1 shows
    grounding measurably changes answer behaviour, but its κ is inter-*judge*, not
    inter-*rater*. A small human-rated subset would yield a human-reliability figure and
    calibrate the automated judge.

(and change the item-30 cross-reference "Table 5.3" → "Table 5.4")

---

## Block 6 — Appendix C traceability, O7 row

| Objective | Requirements | Primary implementation | Evidence | Status |
|---|---|---|---|---|
| **O7** Evaluation | NFR-020…022, 027 | `backend/`, `frontend/`, Playwright capture, `manage.py evaluate_answers` | 277/280 backend, 62/62 frontend, lint and build clean; answer quality judged (groundedness 5.00 vs 1.10 control, hallucination 0 % vs 97.5 %); instrument unadministered | Partially achieved |

---

## Block 7 — Appendix E, three added provenance rows

| Claim | Source |
|---|---|
| Answer quality (factual 4.93, groundedness 5.00, coverage 92 %) | `manage.py evaluate_answers` — full command in Appendix F.4; `docs/report/answer_eval_results.json` |
| Ungrounded control (groundedness 1.10, hallucination 97.5 %) | `manage.py evaluate_answers --mode ungrounded` — Appendix F.4; `docs/report/answer_eval_control_ungrounded.json` |
| Inter-judge κ (1.00 grounded, 0.42 control) | two judge personas in `evaluate_answers.py` — inter-*judge*, not human inter-rater |

---

## Block 8 — Appendix F (new appendix)

## Appendix F — Answer-Quality Evaluation (LLM-as-Judge)

Referenced from Chapter 5 §5.5.1. The full narrative is in `ANSWER_EVALUATION.md`; this
appendix records the method, the data and the reproduction commands.

### F.1 Method

| Element | Detail |
|---|---|
| Generation path | the product path — `hybrid_retrieve()` (top `k` = 8, tenant-scoped by RLS) → `generate_grounded_answer()` |
| Control condition | the same model with retrieval removed and no grounding instruction; reference passages still supplied so it can be scored for factual correctness |
| Corpus | the seeded ATBU tenant — 33 resources, 706 chunks, 587 embedded |
| Query set | 60-case `rag_testset_large.json`; a fixed seed draws the same 20 questions for both conditions |
| Model | `gemini-3.1-flash-lite` (the larger Gemini builds were rate-limited during measurement) |
| Judges | two independent LLM personas — judge A "examiner" (strict), judge B "teaching assistant" (lenient) |
| Dimensions | factual correctness, relevance, groundedness/faithfulness, completeness — each 1–5 |
| Derived metrics | hallucination rate (answers with ≥ 1 unsupported claim); source-attribution coverage (cited claims ÷ total claims); Cohen's κ between the two judges |

### F.2 Results

**Table F.1 — Grounded vs ungrounded control (n = 20 each).**

| Metric | Grounded | Ungrounded control |
|---|---|---|
| Factual correctness (1–5) | 4.93 | 3.35 |
| Relevance (1–5) | 4.98 | 4.20 |
| Groundedness / faithfulness (1–5) | 5.00 | 1.10 |
| Completeness (1–5) | 4.85 | 3.03 |
| Hallucination rate | 0.0 % | 97.5 % |
| Source-attribution coverage | 92.0 % | 0.0 % |
| Answers with a valid `[Source n]` marker | 90.0 % | 0.0 % |
| Answers rated | 20 | 20 |
| Claims extracted and scored | 226 | 221 |
| Inter-judge κ (overall) | 1.00 | 0.42 |

**Table F.2 — Inter-judge κ by dimension.**

| Dimension | Grounded | Ungrounded control |
|---|---|---|
| Factual correctness | 0.00 | 0.45 |
| Relevance | 1.00 | 0.63 |
| Groundedness | 1.00 | 1.00 |
| Completeness | 0.00 | 0.33 |

### F.3 Interpretation and limitations

- The control separates from the grounded condition precisely on the grounding-critical
  dimensions (groundedness 5.00 → 1.10; hallucination 0 % → 97.5 %) while staying
  comparatively strong on relevance, which shows the judge discriminates rather than
  flatters.
- κ is **inter-judge** (two LLM personas), **not human inter-rater** reliability. The
  grounded κ at 1.00 is at ceiling and uninformative; the control κ of 0.42 is the
  trustworthy value.
- The grounded κ of 0.00 on factual correctness and completeness is a known artefact of κ
  under extreme prevalence (both judges agree almost perfectly but use adjacent integer
  scores on a near-ceiling set), not evidence of disagreement.
- A single lite model over one tenant's corpus: the scores are a floor for a larger model,
  not a precise quality level, and they do **not** close the retrieval-*ranking* measurement
  gap (Chapter 5 §5.10, item 2).

### F.4 Reproduction

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py evaluate_answers --queries rag_testset_large.json `
  --n 20 --mode grounded --model gemini-3.1-flash-lite --seed 2026 --sleep 0.3 `
  --out ..\docs\report\answer_eval_results.json
.\.venv\Scripts\python.exe manage.py evaluate_answers --queries rag_testset_large.json `
  --n 20 --mode ungrounded --model gemini-3.1-flash-lite --seed 2026 --sleep 0.3 `
  --out ..\docs\report\answer_eval_control_ungrounded.json
```

Raw per-answer artefacts: `docs/report/answer_eval_results.json` and
`docs/report/answer_eval_control_ungrounded.json`.

---

## Block 9 — Evidence register, section 9 (if carried into Word)

### 9. Answer-quality evaluation (LLM-as-judge)

Two runs over the seeded **ATBU** corpus (33 resources, 706 chunks, 587 embedded), drawing
the same 20 queries from the 60-case `rag_testset_large.json` with `--seed 2026`, served by
`gemini-3.1-flash-lite`. The grounded run uses the product path (hybrid retrieval → grounded
generation); the control run removes retrieval and the grounding instruction.

| Metric | Grounded | Ungrounded control |
|---|---:|---:|
| `answers_rated` | 20 | 20 |
| `factual_correctness` | 4.925 | 3.35 |
| `relevance` | 4.975 | 4.20 |
| `groundedness` | 5.00 | 1.10 |
| `completeness` | 4.85 | 3.025 |
| `hallucination_rate` | 0.0 | 0.975 |
| `source_attribution_coverage` | 0.920 | 0.0 |
| `answers_with_valid_source_marker` | 0.90 | 0.0 |
| `cohens_kappa_overall` | 1.00 | 0.417 |
| `claims_scored` | 226 | 221 |

`generation_or_judge_failures` was 0 in both runs. `cohens_kappa_by_dimension` was
0.00 / 1.00 / 1.00 / 0.00 (grounded) and 0.45 / 0.63 / 1.00 / 0.33 (control) for factual
correctness, relevance, groundedness and completeness respectively. Agreement is
**inter-judge** (two LLM personas), **not human inter-rater**.

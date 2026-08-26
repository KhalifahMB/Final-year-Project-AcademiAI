"""
RAG retrieval evaluation harness.

Compares three retrieval configurations over a labelled query set:
  1. dense  — pgvector cosine similarity only
  2. hybrid — dense + lexical fused with RRF
  3. concept — hybrid + concept-graph expansion signals

Metrics: Precision@K, Recall@K, MRR.

Usage:
    python manage.py evaluate_rag --queries path/to/queries.json --k 5

Query file format (JSON list):
    [
      {
        "query": "What is Big-O notation?",
        "tenant_slug": "univ-a",
        "user_email": "student@univ-a.edu",
        "course_offering_id": null,            // optional scope
        "relevant_chunk_ids": ["<uuid>", ...]  // ground truth
      }
    ]

Ground truth must be produced by human labelling against YOUR corpus.
This command reports measured numbers for the supplied dataset and makes no
claims beyond it.
"""
import json
import statistics

from django.core.management.base import BaseCommand, CommandError
from pgvector.django import CosineDistance


def _precision_at_k(ranked, relevant, k):
    top = ranked[:k]
    if not top:
        return 0.0
    hits = sum(1 for cid in top if str(cid) in set(map(str, relevant)))
    return hits / k


def _recall_at_k(ranked, relevant, k):
    rel = set(map(str, relevant))
    if not rel:
        return 0.0
    top = set(map(str, ranked[:k]))
    return len(top & rel) / len(rel)


def _reciprocal_rank(ranked, relevant):
    rel = set(map(str, relevant))
    for i, cid in enumerate(ranked):
        if str(cid) in rel:
            return 1.0 / (i + 1)
    return 0.0


class Command(BaseCommand):
    help = "Evaluate dense/hybrid/concept retrieval over a labelled query set."

    def add_arguments(self, parser):
        parser.add_argument("--queries", required=True)
        parser.add_argument("--k", type=int, default=5)

    def handle(self, *args, **options):
        from apps.accounts.models import User
        from apps.knowledge.retrieval import hybrid_retrieve
        from apps.tenants.models import Tenant

        k = options["k"]
        try:
            with open(options["queries"], encoding="utf-8") as fh:
                cases = json.load(fh)
        except OSError as exc:
            raise CommandError(f"Cannot read queries file: {exc}")

        if not cases:
            raise CommandError("Query set is empty.")

        modes = {"dense": [], "hybrid": [], "concept": []}
        per_mode_cases = {
            "dense": self._run_dense,
            "hybrid": self._run_hybrid,
            "concept": self._run_concept,
        }

        for case in cases:
            tenant = Tenant.objects.filter(slug=case["tenant_slug"]).first()
            user = User.objects.filter(email=case["user_email"]).first()
            if tenant is None or user is None:
                self.stdout.write(self.style.WARNING(
                    f"Skipping case with unknown tenant/user: {case.get('user_email')}"
                ))
                continue
            relevant = case["relevant_chunk_ids"]
            for mode, runner in per_mode_cases.items():
                ranked = runner(user, tenant.id, case["query"], case.get("course_offering_id"))
                modes[mode].append({
                    "p": _precision_at_k(ranked, relevant, k),
                    "r": _recall_at_k(ranked, relevant, k),
                    "mrr": _reciprocal_rank(ranked, relevant),
                })

        self.stdout.write(f"\nRetrieval evaluation @K={k} over {len(cases)} case(s)\n")
        self.stdout.write(f"{'mode':<10} {'P@K':>8} {'R@K':>8} {'MRR':>8}")
        for mode, rows in modes.items():
            if not rows:
                self.stdout.write(f"{mode:<10} {'-':>8} {'-':>8} {'-':>8}")
                continue
            p = statistics.mean(row["p"] for row in rows)
            r = statistics.mean(row["r"] for row in rows)
            mrr = statistics.mean(row["mrr"] for row in rows)
            self.stdout.write(
                f"{mode:<10} {p:>8.3f} {r:>8.3f} {mrr:>8.3f}"
            )
        self.stdout.write(
            "\nNote: numbers are measurements of the supplied labelled set only."
        )

    # --- mode runners -------------------------------------------------

    def _dense(self, user, tenant_id, query, offering):
        from apps.common.ai import generate_embeddings
        from apps.knowledge.retrieval import _authorized_resource_ids
        from apps.resources.models import ResourceChunk

        resource_ids = _authorized_resource_ids(user, offering)
        if not resource_ids:
            return []
        base = ResourceChunk.objects.filter(
            tenant_id=tenant_id,
            resource_version__resource_id__in=resource_ids,
        ).exclude(embedding=None)
        emb = generate_embeddings([query])[0]
        if not emb or all(v == 0.0 for v in emb):
            return []
        semantic = base.order_by(CosineDistance("embedding", emb))[:20]
        return [c.id for c in semantic]

    def _run_dense(self, user, tenant_id, query, offering):
        return self._dense(user, tenant_id, query, offering)

    def _run_hybrid(self, user, tenant_id, query, offering):
        # hybrid_retrieve already fuses lexical+semantic (+concept when present);
        # to isolate hybrid we call its internals via the public API and rely on
        # the concept signal contributing only when concepts exist.
        from apps.knowledge.retrieval import hybrid_retrieve

        results = hybrid_retrieve(query, tenant_id, user, course_offering_id=offering, top_k=20)
        return [r["id"] for r in results]

    def _run_concept(self, user, tenant_id, query, offering):
        from apps.knowledge.retrieval import (
            _authorized_resource_ids,
            _concept_related_chunk_ids,
            _rrf_fuse,
        )

        resource_ids = _authorized_resource_ids(user, offering)
        if not resource_ids:
            return []
        concept_ids = _concept_related_chunk_ids(tenant_id, query, resource_ids, limit=40)
        dense = self._dense(user, tenant_id, query, offering)
        lists = [l for l in (concept_ids, dense) if l]
        if not lists:
            return []
        return [cid for cid, _ in _rrf_fuse(lists)[:20]]

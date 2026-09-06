"""
Build a labelled RAG test set from the tenant's actual corpus for
`evaluate_rag`. Ground truth is derived heuristically: for each pseudo-query
built from a chunk's salient keywords, the "relevant chunks" are those whose
content shares the most term overlap. This gives a self-checking dataset that
always matches the seeded content, so quality gates can run offline.

Usage:
    python manage.py build_rag_testset --tenant ATBU \
        --user student@demo.local --out testset.json --n 40

The generated file is consumed by:
    python manage.py evaluate_rag --queries testset.json --k 5
"""
import json
import re
import random

from django.core.management.base import BaseCommand, CommandError

STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "are", "was", "were",
    "will", "have", "has", "had", "been", "would", "could", "should", "what",
    "which", "when", "where", "how", "why", "all", "can", "its", "their", "them",
    "they", "such", "these", "those", "than", "then", "into", "over", "under",
    "not", "but", "or", "of", "in", "on", "at", "to", "a", "an", "about",
}


def _keywords(text, top=4):
    words = re.findall(r"[A-Za-z]{3,}", text.lower())
    freq = {}
    for w in words:
        if w in STOPWORDS:
            continue
        freq[w] = freq.get(w, 0) + 1
    ranked = sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))
    return [w for w, _ in ranked[:top]]


def _overlap(a, b):
    return len(set(a) & set(b))


class Command(BaseCommand):
    help = "Generate a self-checking RAG test set from the tenant's corpus."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", required=True)
        parser.add_argument("--user", required=True)
        parser.add_argument("--out", required=True)
        parser.add_argument("--n", type=int, default=40)

    def handle(self, *args, **options):
        from apps.accounts.models import User
        from apps.knowledge.retrieval import _authorized_resource_ids
        from apps.resources.models import ResourceChunk
        from apps.tenants.models import Tenant

        tenant = Tenant.objects.filter(slug=options["tenant"]).first()
        if tenant is None:
            raise CommandError(f"Tenant not found: {options['tenant']}")
        user = User.objects.filter(email=options["user"], tenant=tenant).first()
        if user is None:
            raise CommandError(
                f"User not found: {options['user']} in {tenant.slug}"
            )

        resource_ids = _authorized_resource_ids(user, None)
        if not resource_ids:
            raise CommandError("User has no authorised resources to test on.")

        chunks = list(
            ResourceChunk.objects.filter(
                tenant_id=tenant.id,
                resource_version__resource_id__in=resource_ids,
            )
            .exclude(embedding=None)
            .order_by("?")[: int(options["n"]) * 4]
            .values("id", "content")
        )
        if not chunks:
            raise CommandError("No embedded chunks found for the user's corpus.")

        random.seed(2026)
        cases = []
        pool = list(chunks)
        for _ in range(int(options["n"])):
            if not pool:
                break
            anchor = random.choice(pool)
            kws = _keywords(anchor["content"])
            if len(kws) < 2:
                continue
            query = f"What do you know about: {' '.join(kws)}?"
            # Ground truth: any chunk sharing >= 2 keyword terms with the query.
            relevant = [
                str(c["id"])
                for c in pool
                if _overlap(kws, _keywords(c["content"])) >= 2
            ]
            if not relevant:
                continue
            cases.append(
                {
                    "query": query,
                    "tenant_slug": tenant.slug,
                    "user_email": user.email,
                    "course_offering_id": None,
                    "relevant_chunk_ids": relevant,
                }
            )

        if not cases:
            raise CommandError(
                "Could not generate any cases from the corpus. "
                "Check that resources have been ingested (READY) and embedded."
            )

        with open(options["out"], "w", encoding="utf-8") as fh:
            json.dump(cases, fh, indent=2)

        self.stdout.write(self.style.SUCCESS(
            f"Wrote {len(cases)} cases to {options['out']} "
            f"({tenant.slug} / {user.email})"
        ))

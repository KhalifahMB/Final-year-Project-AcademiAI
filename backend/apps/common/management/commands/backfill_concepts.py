"""
Backfill the concept graph for resources ingested before concept extraction
existed. For every READY resource whose version has embedded chunks but no
ResourceConcept rows, this reconstructs the document text from its chunks and
runs the same extraction + persistence path the ingestion pipeline uses.

Idempotent: resources that already have ResourceConcept rows are skipped.
Concepts are upserted per tenant by canonical name, so re-runs do not create
duplicates.

Usage:
    python manage.py backfill_concepts [--tenant ATBU] [--dry-run]
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.common.db import tenant_scope
from apps.resources.models import Resource, ResourceVersion


class Command(BaseCommand):
    help = (
        "Backfill concept graph rows (Concept/ResourceConcept/ConceptEdge) "
        "for resources ingested before concept extraction was added."
    )

    def add_arguments(self, parser):
        parser.add_argument("--tenant", help="Only process this tenant slug.")
        parser.add_argument("--dry-run", action="store_true", help="Report what would be processed.")

    def handle(self, *args, **options):
        from apps.common.ai import extract_concepts
        from apps.resources.tasks import _persist_concepts_and_edges

        qs = Resource.objects.filter(processing_status=Resource.ProcessingStatus.READY)
        if options["tenant"]:
            qs = qs.filter(tenant__slug=options["tenant"])

        picked = 0
        skipped = 0
        for resource in qs.order_by("tenant_id", "id"):
            version = (
                ResourceVersion.objects.filter(resource=resource)
                .order_by("-version_number")
                .first()
            )
            if version is None:
                skipped += 1
                continue
            with tenant_scope(resource.tenant_id) as _scope:
                if resource.resource_concepts.exists():
                    skipped += 1
                    continue
                from apps.resources.models import ResourceChunk

                chunks = (
                    ResourceChunk.objects.filter(resource_version=version)
                    .order_by("chunk_index")
                    .values_list("content", flat=True)
                )
                text = "\n\n".join(str(c) for c in chunks if c)
                if not text.strip() or not chunks:
                    self.stdout.write(self.style.WARNING(
                        f"skip {resource.id} — no chunks to backfill from"
                    ))
                    skipped += 1
                    continue

                if options["dry_run"]:
                    self.stdout.write(
                        f"would backfill {resource.id} ({resource.title}) — "
                        f"{len(chunks)} chunks"
                    )
                    picked += 1
                    continue

                payload = extract_concepts(text)
                with tenant_scope(resource.tenant_id), transaction.atomic():
                    _persist_concepts_and_edges(resource, version, payload, resource.tenant_id)
                n_concepts = len(payload.get("concepts") or [])
                n_rels = len(payload.get("relations") or [])
                self.stdout.write(self.style.SUCCESS(
                    f"backfilled {resource.id} ({resource.title}): "
                    f"{n_concepts} concepts, {n_rels} relations"
                ))
                picked += 1

        self.stdout.write(self.style.SUCCESS(f"Done: backfilled {picked}, skipped {skipped}."))
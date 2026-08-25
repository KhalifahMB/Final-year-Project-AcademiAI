"""
Concept graph for concept-aware retrieval.
"""
from django.db import models

from apps.common.models import TenantScopedModel


class Concept(TenantScopedModel):
    canonical_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "concepts"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "canonical_name"], name="uniq_concept_name_per_tenant"
            )
        ]
        ordering = ["canonical_name"]

    def __str__(self):
        return self.canonical_name


class ResourceConcept(models.Model):
    resource = models.ForeignKey(
        "resources.Resource", on_delete=models.CASCADE, related_name="resource_concepts"
    )
    concept = models.ForeignKey(Concept, on_delete=models.CASCADE, related_name="resource_links")
    confidence = models.FloatField(default=1.0)
    source_chunk = models.ForeignKey(
        "resources.ResourceChunk",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        db_table = "resource_concepts"
        constraints = [
            models.UniqueConstraint(
                fields=["resource", "concept"], name="uniq_resource_concept"
            )
        ]


class ConceptEdge(TenantScopedModel):
    source_concept = models.ForeignKey(
        Concept, on_delete=models.CASCADE, related_name="outgoing_edges"
    )
    target_concept = models.ForeignKey(
        Concept, on_delete=models.CASCADE, related_name="incoming_edges"
    )
    relation_type = models.CharField(max_length=50)  # related_to, prerequisite, part_of...
    weight = models.FloatField(default=1.0)

    class Meta:
        db_table = "concept_edges"
        constraints = [
            models.UniqueConstraint(
                fields=["source_concept", "target_concept", "relation_type"],
                name="uniq_concept_edge",
            )
        ]

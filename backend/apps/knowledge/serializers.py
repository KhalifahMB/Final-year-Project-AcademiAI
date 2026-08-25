from rest_framework import serializers
from .models import Concept, ConceptEdge, ResourceConcept

class ConceptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Concept
        fields = ("id", "canonical_name", "description", "tenant", "created_at")
        read_only_fields = ("id", "tenant", "created_at")

class ConceptEdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConceptEdge
        fields = (
            "id", "source_concept", "target_concept", "relation_type", "weight", "tenant", "created_at",
        )
        read_only_fields = ("id", "tenant", "created_at")

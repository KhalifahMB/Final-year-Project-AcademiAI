from apps.common.viewsets import TenantModelViewSet
from .models import Concept, ConceptEdge
from .serializers import ConceptSerializer, ConceptEdgeSerializer

class ConceptViewSet(TenantModelViewSet):
    queryset = Concept.objects.all()
    serializer_class = ConceptSerializer
    search_fields = ["canonical_name", "description"]

class ConceptEdgeViewSet(TenantModelViewSet):
    queryset = ConceptEdge.objects.select_related("source_concept", "target_concept")
    serializer_class = ConceptEdgeSerializer
    filterset_fields = ["source_concept", "target_concept", "relation_type"]

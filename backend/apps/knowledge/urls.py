from rest_framework.routers import DefaultRouter
from .views import ConceptViewSet, ConceptEdgeViewSet

router = DefaultRouter()
router.register("concepts", ConceptViewSet, basename="concept")
router.register("concept-edges", ConceptEdgeViewSet, basename="concept-edge")
urlpatterns = router.urls

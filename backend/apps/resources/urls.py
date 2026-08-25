from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ResourceViewSet, ResourceVersionViewSet

router = DefaultRouter()
router.register("resources", ResourceViewSet, basename="resource")

versions_list = ResourceVersionViewSet.as_view({"get": "list", "post": "create"})
versions_detail = ResourceVersionViewSet.as_view({"get": "retrieve"})

urlpatterns = [
    path(
        "resources/<uuid:resource_pk>/versions/",
        versions_list,
        name="resource-versions-list",
    ),
    path(
        "resources/<uuid:resource_pk>/versions/<uuid:pk>/",
        versions_detail,
        name="resource-versions-detail",
    ),
] + router.urls

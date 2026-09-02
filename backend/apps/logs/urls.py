from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantLogViewSet

router = DefaultRouter()
router.register(r"logs", TenantLogViewSet, basename="tenant-logs")

urlpatterns = [
    path("", include(router.urls)),
]

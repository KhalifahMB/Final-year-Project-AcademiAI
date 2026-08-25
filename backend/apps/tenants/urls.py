from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, TenantDirectoryView

router = DefaultRouter()
router.register("tenants", TenantViewSet, basename="tenant")

urlpatterns = [
    # Declared before the router so "directory" is not treated as a tenant id.
    path("tenants/directory/", TenantDirectoryView.as_view(), name="tenant-directory"),
] + router.urls

from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, TenantDirectoryView
from .stats import PlatformStatsView, PlatformTenantDetailView, PlatformAuditLogView

router = DefaultRouter()
router.register("tenants", TenantViewSet, basename="tenant")

urlpatterns = [
    # Declared before the router so "directory" is not treated as a tenant id.
    path("tenants/directory/", TenantDirectoryView.as_view(), name="tenant-directory"),
    # Superuser-only aggregate stats for the platform console.
    path("platform/stats/", PlatformStatsView.as_view(), name="platform-stats"),
    path(
        "platform/tenants/<uuid:tenant_id>/",
        PlatformTenantDetailView.as_view(),
        name="platform-tenant-detail",
    ),
    path(
        "platform/audit-logs/",
        PlatformAuditLogView.as_view(),
        name="platform-audit-logs",
    ),
] + router.urls

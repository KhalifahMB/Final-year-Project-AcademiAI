from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import TenantViewSet, TenantDirectoryView
from .request_views import (
    TenantRequestCreateView, TenantRequestEmailCheckView, TenantRequestListView, TenantRequestReviewView,
)
from .stats import PlatformStatsView, PlatformTenantDetailView, PlatformAuditLogView
from apps.common.dashboard import (
    StudentDashboardView, AdminDashboardView,
    StudentActivityView, AdminAuditSummaryView,
)

router = DefaultRouter()
router.register("tenants", TenantViewSet, basename="tenant")

urlpatterns = [
    path("tenants/directory/", TenantDirectoryView.as_view(), name="tenant-directory"),
    # Self-serve institution request flow
    path("tenant-requests/check-email/", TenantRequestEmailCheckView.as_view(), name="tenant-request-check-email"),
    path("tenant-requests/", TenantRequestCreateView.as_view(), name="tenant-request-create"),
    path("platform/tenant-requests/", TenantRequestListView.as_view(), name="platform-tenant-requests"),
    path("platform/tenant-requests/<uuid:pk>/review/", TenantRequestReviewView.as_view(), name="platform-tenant-request-review"),
    # Aggregate dashboards (one call per role replaces 4-15 list requests)
    path("dashboard/student/", StudentDashboardView.as_view(), name="dashboard-student"),
    path("dashboard/admin/", AdminDashboardView.as_view(), name="dashboard-admin"),
    path("dashboard/student/activity/", StudentActivityView.as_view(), name="dashboard-student-activity"),
    path("dashboard/admin/audit-summary/", AdminAuditSummaryView.as_view(), name="dashboard-admin-audit-summary"),
    # Superuser-only platform aggregates
    path("platform/stats/", PlatformStatsView.as_view(), name="platform-stats"),
    path("platform/tenants/<uuid:tenant_id>/", PlatformTenantDetailView.as_view(), name="platform-tenant-detail"),
    path("platform/audit-logs/", PlatformAuditLogView.as_view(), name="platform-audit-logs"),
] + router.urls

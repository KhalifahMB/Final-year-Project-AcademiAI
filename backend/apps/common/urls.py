from django.urls import path
from .views import JobStatusView, HealthView, SystemHealthView
from .dashboard import (
    StudentDashboardView,
    AdminDashboardView,
    StudentActivityView,
    AdminAuditSummaryView,
    LecturerDashboardView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("jobs/<str:job_id>/", JobStatusView.as_view(), name="job-status"),
    path("platform/health/", SystemHealthView.as_view(), name="platform-health"),
    # Dashboard aggregates
    path("dashboard/student/", StudentDashboardView.as_view(), name="dashboard-student"),
    path(
        "dashboard/student/activity/",
        StudentActivityView.as_view(),
        name="dashboard-student-activity",
    ),
    path("dashboard/admin/", AdminDashboardView.as_view(), name="dashboard-admin"),
    path(
        "dashboard/admin/audit-summary/",
        AdminAuditSummaryView.as_view(),
        name="dashboard-admin-audit-summary",
    ),
    path(
        "dashboard/lecturer/",
        LecturerDashboardView.as_view(),
        name="dashboard-lecturer",
    ),
]

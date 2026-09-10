from django.urls import path
from .views import JobStatusView, HealthView, ReadinessView, SystemHealthView
from .dashboard import LecturerDashboardView, AiGreetingView, AiInsightView

urlpatterns = [
    path("health/ready/", ReadinessView.as_view(), name="health-ready"),
    path("health/", HealthView.as_view(), name="health"),
    path("jobs/<str:job_id>/", JobStatusView.as_view(), name="job-status"),
    path("platform/health/", SystemHealthView.as_view(), name="platform-health"),
    # Dashboard aggregates (student/admin/lecturer live under /api/v1/dashboard/
    # in apps/tenants/urls.py; only lecturer + AI endpoints are tenant-scoped extras)
    path(
        "dashboard/lecturer/",
        LecturerDashboardView.as_view(),
        name="dashboard-lecturer",
    ),
    path("dashboard/ai-greeting/", AiGreetingView.as_view(), name="dashboard-ai-greeting"),
    path("dashboard/ai-insight/", AiInsightView.as_view(), name="dashboard-ai-insight"),
]

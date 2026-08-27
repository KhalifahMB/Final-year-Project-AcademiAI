from django.urls import path
from .views import JobStatusView, HealthView, SystemHealthView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("jobs/<str:job_id>/", JobStatusView.as_view(), name="job-status"),
    path("platform/health/", SystemHealthView.as_view(), name="platform-health"),
]

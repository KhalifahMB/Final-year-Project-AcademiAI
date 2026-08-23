from django.urls import path
from .views import JobStatusView

urlpatterns = [
    path("jobs/<str:job_id>/", JobStatusView.as_view(), name="job-status"),
]

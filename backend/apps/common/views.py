from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.jobs import get_job_status


class JobStatusView(APIView):
    """GET /api/v1/jobs/{job_id}/ — poll Celery task status."""

    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        return Response(get_job_status(str(job_id)))

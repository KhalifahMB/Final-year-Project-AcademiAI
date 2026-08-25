from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.jobs import get_job_status, is_job_owner


class JobStatusSerializer(serializers.Serializer):
    job_id = serializers.CharField()
    status = serializers.CharField()
    ready = serializers.BooleanField()
    successful = serializers.BooleanField(allow_null=True)
    result = serializers.JSONField(required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)


@extend_schema(tags=["System"])
class JobStatusView(APIView):
    """GET /api/v1/jobs/{job_id}/ — poll the status of a job you dispatched."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: JobStatusSerializer, 404: None},
        summary="Poll the status of an asynchronous job",
        description=(
            "Returns state and result for asynchronous jobs (AI summaries, "
            "quiz generation, document ingestion). Only the user who "
            "dispatched the job may read it."
        ),
    )
    def get(self, request, job_id):
        # Job results can contain tenant-private payloads; verify ownership
        # before touching the result backend.
        if not request.user.is_superuser and not is_job_owner(job_id, request.user.id):
            return Response(
                {"success": False, "error": {"detail": "Job not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(get_job_status(str(job_id)))


@extend_schema(tags=["System"])
class HealthView(APIView):
    """GET /api/v1/health/ — public liveness."""
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        responses={200: JobStatusSerializer},
        summary="Service liveness probe",
        auth=[],
    )
    def get(self, request):
        return Response({"status": "ok", "service": "academiai"})

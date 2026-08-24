from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.jobs import get_job_status


class JobStatusSerializer(serializers.Serializer):
    job_id = serializers.CharField()
    status = serializers.CharField()
    ready = serializers.BooleanField()
    successful = serializers.BooleanField(allow_null=True)
    result = serializers.JSONField(required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)


class JobStatusView(APIView):
    """GET /api/v1/jobs/{job_id}/ — poll Celery task status."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: JobStatusSerializer},
        summary="Poll the status of an asynchronous job",
    )
    def get(self, request, job_id):
        return Response(get_job_status(str(job_id)))


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

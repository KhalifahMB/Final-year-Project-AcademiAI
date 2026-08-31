from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.jobs import get_job_status, is_job_owner
from apps.common.permissions import IsSuperuser


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


@extend_schema(
    tags=["Platform"],
    summary="System health check for platform operators",
    description="Superuser-only. Checks PostgreSQL, Redis, RabbitMQ, and Celery worker status.",
)
class SystemHealthView(APIView):
    permission_classes = [IsSuperuser]

    def get(self, request):
        import time
        from django.conf import settings

        health = {}

        # ── PostgreSQL ─────────────────────────────────────────────
        try:
            from django.db import connection

            start = time.time()
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            pg_latency = round((time.time() - start) * 1000, 2)
            health["postgres"] = {"status": "healthy", "latency_ms": pg_latency}
        except Exception as e:
            health["postgres"] = {"status": "unhealthy", "error": str(e)}

        # ── Redis ──────────────────────────────────────────────────
        try:
            from django.core.cache import cache

            start = time.time()
            cache.set("_health_check", "ok", 10)
            val = cache.get("_health_check")
            redis_latency = round((time.time() - start) * 1000, 2)
            if val == "ok":
                health["redis"] = {"status": "healthy", "latency_ms": redis_latency}
            else:
                health["redis"] = {"status": "degraded", "detail": "read/write mismatch"}
        except Exception as e:
            health["redis"] = {"status": "unhealthy", "error": str(e)}

        # ── RabbitMQ (via Celery inspect) ──────────────────────────
        try:
            from celery import current_app

            inspect = current_app.control.inspect(timeout=3.0)
            active = inspect.active() or {}
            registered = inspect.registered() or {}
            stats_info = inspect.stats() or {}

            worker_count = len(active)
            total_active_tasks = sum(len(tasks) for tasks in active.values())
            total_registered = sum(len(tasks) for tasks in registered.values())

            queue_depths = {}
            for worker, worker_stats in stats_info.items():
                if "pool" in worker_stats:
                    queue_depths[worker] = worker_stats.get("pool", {}).get("writes", 0)

            health["celery"] = {
                "status": "healthy" if worker_count > 0 else "no_workers",
                "active_workers": worker_count,
                "active_tasks": total_active_tasks,
                "registered_tasks": total_registered,
                "queue_depths": queue_depths,
            }
        except Exception as e:
            health["celery"] = {"status": "unhealthy", "error": str(e)}

        # ── RabbitMQ direct check (versions + queue inventory) ──────
        try:
            import os
            import urllib.request
            import base64

            rmq_user = os.getenv("RABBITMQ_DEFAULT_USER", "academiai")
            rmq_pass = os.getenv("RABBITMQ_DEFAULT_PASS", "academiai")
            rmq_host = os.getenv("RABBITMQ_HOST", "localhost")
            rmq_port = os.getenv("RABBITMQ_MGMT_PORT", "15672")

            credentials = base64.b64encode(f"{rmq_user}:{rmq_pass}".encode()).decode()
            headers = {"Authorization": f"Basic {credentials}"}

            def _get(path):
                req = urllib.request.Request(
                    f"http://{rmq_host}:{rmq_port}{path}", headers=headers
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return __import__("json").loads(resp.read())

            overview = _get("/api/overview")
            queues = _get("/api/queues?columns=name,messages,consumers")

            queue_list = sorted(
                (
                    {
                        "name": q.get("name"),
                        "messages": q.get("messages", 0),
                        "consumers": q.get("consumers", 0),
                    }
                    for q in queues
                ),
                key=lambda q: q["name"],
            )
            dead_letter = next(
                (q for q in queue_list if q["name"].endswith("dlq")), None
            )

            health["rabbitmq"] = {
                "status": "healthy",
                "version": overview.get("rabbitmq_version", "unknown"),
                "erlang_version": overview.get("erlang_version", "unknown"),
                "queues": queue_list,
                "dead_letter": {
                    "messages": dead_letter["messages"] if dead_letter else 0,
                    "queue": dead_letter["name"] if dead_letter else "dlq",
                },
            }
        except Exception as e:
            health["rabbitmq"] = {"status": "unhealthy", "error": str(e)}

        # ── Object storage ─────────────────────────────────────────
        try:
            from apps.common.storage import get_s3_client

            s3 = get_s3_client()
            s3.head_bucket(Bucket=settings.AWS_STORAGE_BUCKET_NAME)
            health["storage"] = {
                "status": "healthy",
                "bucket": settings.AWS_STORAGE_BUCKET_NAME,
            }
        except Exception as e:
            health["storage"] = {"status": "unhealthy", "error": str(e)}

        # ── Overall status ─────────────────────────────────────────
        statuses = [v.get("status") for v in health.values()]
        if all(s == "healthy" for s in statuses):
            health["overall"] = "healthy"
        elif any(s == "unhealthy" for s in statuses):
            health["overall"] = "unhealthy"
        else:
            health["overall"] = "degraded"

        return Response(health)

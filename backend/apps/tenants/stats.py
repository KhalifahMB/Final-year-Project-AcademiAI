"""
Platform-level aggregate statistics (superuser only).
"""
from datetime import timedelta

from django.db.models import Count, Q, Sum, F
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsSuperuser
from .models import Tenant


@extend_schema(
    tags=["Platform"],
    summary="Platform-wide aggregate statistics",
    description=(
        "Superuser-only. Returns comprehensive platform metrics: tenant counts, "
        "user counts by role, resource storage, chat activity, quiz usage, "
        "and growth trends."
    ),
)
class PlatformStatsView(APIView):
    permission_classes = [IsSuperuser]

    def get(self, request):
        qs = Tenant.objects.all()
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # ── Tenant counts ──────────────────────────────────────────
        status_counts = qs.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(status=Tenant.Status.ACTIVE)),
            suspended=Count("id", filter=Q(status=Tenant.Status.SUSPENDED)),
            pending=Count("id", filter=Q(status=Tenant.Status.PENDING)),
        )
        plan_qs = qs.values("plan").annotate(count=Count("id")).order_by("-count")
        plans = {row["plan"] or "standard": row["count"] for row in plan_qs}

        # ── User counts (cross-tenant) ─────────────────────────────
        try:
            from apps.accounts.models import User

            user_qs = User.objects.all()
            total_users = user_qs.count()
            users_by_role = {
                row["role"]: row["count"]
                for row in user_qs.values("role").annotate(count=Count("id"))
            }
            users_joined_week = user_qs.filter(created_at__gte=week_ago).count()
            users_joined_month = user_qs.filter(created_at__gte=month_ago).count()
        except Exception:
            total_users = None
            users_by_role = {}
            users_joined_week = 0
            users_joined_month = 0

        # ── Resource counts & storage ──────────────────────────────
        try:
            from apps.resources.models import Resource, ResourceChunk

            res_qs = Resource.objects.all()
            total_resources = res_qs.count()
            resources_by_status = {
                row["processing_status"]: row["count"]
                for row in res_qs.values("processing_status").annotate(count=Count("id"))
            }
            total_storage = res_qs.aggregate(
                total=Sum("versions__file_size_bytes")
            )["total"] or 0
            total_chunks = ResourceChunk.objects.count()
            resources_uploaded_week = res_qs.filter(created_at__gte=week_ago).count()
            resources_uploaded_month = res_qs.filter(created_at__gte=month_ago).count()
        except Exception:
            total_resources = 0
            resources_by_status = {}
            total_storage = 0
            total_chunks = 0
            resources_uploaded_week = 0
            resources_uploaded_month = 0

        # ── Chat metrics ───────────────────────────────────────────
        try:
            from apps.chat.models import ChatSession, ChatMessage

            total_sessions = ChatSession.objects.count()
            total_messages = ChatMessage.objects.filter(role="user").count()
            messages_week = ChatMessage.objects.filter(
                role="user", created_at__gte=week_ago
            ).count()
        except Exception:
            total_sessions = 0
            total_messages = 0
            messages_week = 0

        # ── Quiz metrics ───────────────────────────────────────────
        try:
            from apps.assessments.models import Quiz, QuizAttempt

            total_quizzes = Quiz.objects.count()
            total_attempts = QuizAttempt.objects.count()
            avg_score_agg = QuizAttempt.objects.filter(
                score__isnull=False
            ).aggregate(avg=Count("score"))
            avg_score = None  # simplified
        except Exception:
            total_quizzes = 0
            total_attempts = 0
            avg_score = None

        # ── Top tenants by user count ──────────────────────────────
        try:
            from apps.accounts.models import User

            top_tenants = list(
                User.objects.filter(tenant__isnull=False)
                .values("tenant__name", "tenant__slug")
                .annotate(user_count=Count("id"))
                .order_by("-user_count")[:10]
            )
        except Exception:
            top_tenants = []

        # ── Tenant provisioning trend (last 30 days) ───────────────
        try:
            from django.db.models.functions import TruncDate

            tenant_trend = list(
                qs.filter(created_at__gte=month_ago)
                .annotate(date=TruncDate("created_at"))
                .values("date")
                .annotate(count=Count("id"))
                .order_by("date")
            )
            tenant_trend = [
                {"date": str(row["date"]), "count": row["count"]}
                for row in tenant_trend
            ]
        except Exception:
            tenant_trend = []

        # ── User signup trend (last 30 days) ───────────────────────
        try:
            from apps.accounts.models import User
            from django.db.models.functions import TruncDate

            user_trend = list(
                User.objects.filter(created_at__gte=month_ago)
                .annotate(date=TruncDate("created_at"))
                .values("date")
                .annotate(count=Count("id"))
                .order_by("date")
            )
            user_trend = [
                {"date": str(row["date"]), "count": row["count"]}
                for row in user_trend
            ]
        except Exception:
            user_trend = []

        return Response(
            {
                "tenants": {
                    "total": status_counts["total"],
                    "active": status_counts["active"],
                    "suspended": status_counts["suspended"],
                    "pending": status_counts["pending"],
                    "by_plan": plans,
                },
                "users": {
                    "total": total_users,
                    "by_role": users_by_role,
                    "joined_this_week": users_joined_week,
                    "joined_this_month": users_joined_month,
                },
                "resources": {
                    "total": total_resources,
                    "by_status": resources_by_status,
                    "total_storage_bytes": total_storage,
                    "total_chunks": total_chunks,
                    "uploaded_this_week": resources_uploaded_week,
                    "uploaded_this_month": resources_uploaded_month,
                },
                "chat": {
                    "total_sessions": total_sessions,
                    "total_messages": total_messages,
                    "messages_this_week": messages_week,
                },
                "quizzes": {
                    "total": total_quizzes,
                    "total_attempts": total_attempts,
                },
                "trends": {
                    "tenant_provisioning": tenant_trend,
                    "user_signups": user_trend,
                },
                "top_tenants": top_tenants,
            }
        )


@extend_schema(
    tags=["Platform"],
    summary="Detailed stats for a specific tenant",
    description="Superuser-only. Returns per-tenant breakdown of users, resources, chat, quizzes, and academic structure.",
)
class PlatformTenantDetailView(APIView):
    permission_classes = [IsSuperuser]

    def get(self, request, tenant_id):
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response(
                {"error": {"detail": "Tenant not found."}}, status=404
            )

        # ── Users ──────────────────────────────────────────────────
        try:
            from apps.accounts.models import User

            user_qs = User.objects.filter(tenant=tenant)
            users_total = user_qs.count()
            users_by_role = {
                row["role"]: row["count"]
                for row in user_qs.values("role").annotate(count=Count("id"))
            }
            users_verified = user_qs.filter(is_email_verified=True).count()
        except Exception:
            users_total = 0
            users_by_role = {}
            users_verified = 0

        # ── Resources ──────────────────────────────────────────────
        try:
            from apps.resources.models import Resource, ResourceChunk

            res_qs = Resource.objects.filter(tenant=tenant)
            resources_total = res_qs.count()
            resources_by_status = {
                row["processing_status"]: row["count"]
                for row in res_qs.values("processing_status").annotate(count=Count("id"))
            }
            storage_used = (
                res_qs.aggregate(total=Sum("versions__file_size_bytes"))["total"] or 0
            )
            chunks_total = ResourceChunk.objects.filter(tenant=tenant).count()
        except Exception:
            resources_total = 0
            resources_by_status = {}
            storage_used = 0
            chunks_total = 0

        # ── Chat ───────────────────────────────────────────────────
        try:
            from apps.chat.models import ChatSession, ChatMessage

            chat_sessions = ChatSession.objects.filter(tenant=tenant).count()
            chat_messages = ChatMessage.objects.filter(
                session__tenant=tenant, role="user"
            ).count()
        except Exception:
            chat_sessions = 0
            chat_messages = 0

        # ── Quizzes ────────────────────────────────────────────────
        try:
            from apps.assessments.models import Quiz, QuizAttempt

            quizzes_total = Quiz.objects.filter(tenant=tenant).count()
            quiz_attempts = QuizAttempt.objects.filter(
                quiz__tenant=tenant
            ).count()
        except Exception:
            quizzes_total = 0
            quiz_attempts = 0

        # ── Academic structure ─────────────────────────────────────
        try:
            from apps.academics.models import (
                Faculty, Department, Programme, Course, CourseOffering, CourseEnrollment,
            )

            faculties = Faculty.objects.filter(tenant=tenant).count()
            departments = Department.objects.filter(tenant=tenant).count()
            programmes = Programme.objects.filter(tenant=tenant).count()
            courses = Course.objects.filter(tenant=tenant).count()
            offerings = CourseOffering.objects.filter(tenant=tenant).count()
            enrollments = CourseEnrollment.objects.filter(
                offering__tenant=tenant
            ).count()
        except Exception:
            faculties = 0
            departments = 0
            programmes = 0
            courses = 0
            offerings = 0
            enrollments = 0

        return Response(
            {
                "tenant": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "slug": tenant.slug,
                    "domain": tenant.domain,
                    "status": tenant.status,
                    "plan": tenant.plan,
                    "storage_quota_bytes": tenant.storage_quota_bytes,
                    "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
                },
                "stats": {
                    "users": {
                        "total": users_total,
                        "by_role": users_by_role,
                        "verified": users_verified,
                    },
                    "resources": {
                        "total": resources_total,
                        "by_status": resources_by_status,
                        "storage_used_bytes": storage_used,
                        "chunks": chunks_total,
                    },
                    "chat": {
                        "sessions": chat_sessions,
                        "messages": chat_messages,
                    },
                    "quizzes": {
                        "total": quizzes_total,
                        "attempts": quiz_attempts,
                    },
                    "academic": {
                        "faculties": faculties,
                        "departments": departments,
                        "programmes": programmes,
                        "courses": courses,
                        "offerings": offerings,
                        "enrollments": enrollments,
                    },
                },
            }
        )


class PlatformAuditLogPagination(PageNumberPagination):
    page_size = 20
    max_page_size = 100


@extend_schema(
    tags=["Platform"],
    summary="Cross-tenant platform audit log",
    description="Superuser-only. Lists audit log entries across all tenants with tenant name annotation.",
)
class PlatformAuditLogView(APIView):
    permission_classes = [IsSuperuser]
    pagination_class = PlatformAuditLogPagination

    def get(self, request):
        from apps.audit.models import AuditLog

        qs = AuditLog.objects.select_related("actor", "tenant").order_by("-created_at")

        # Filtering
        action = request.query_params.get("action", "").strip()
        if action:
            qs = qs.filter(action__icontains=action)

        entity_type = request.query_params.get("entity_type", "").strip()
        if entity_type:
            qs = qs.filter(entity_type__icontains=entity_type)

        tenant_id = request.query_params.get("tenant_id", "").strip()
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        # Date range
        date_from = request.query_params.get("date_from", "").strip()
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get("date_to", "").strip()
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        # Paginate
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)

        results = []
        for log in page:
            results.append({
                "id": str(log.id),
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": str(log.entity_id) if log.entity_id else None,
                "metadata": log.metadata,
                "actor_email": log.actor.email if log.actor else None,
                "tenant_name": log.tenant.name if log.tenant else None,
                "tenant_id": str(log.tenant_id) if log.tenant_id else None,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            })

        return paginator.get_paginated_response(results)

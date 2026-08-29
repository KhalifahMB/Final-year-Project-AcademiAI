"""
Aggregate dashboard endpoints.

One call per role returns every card/chart/activity widget the frontend
needs. This replaces N+1 GETs from the client (the admin dashboard was
firing 15 parallel list requests just to compute counts).

Responses are cached in Redis for STALE_SECONDS per tenant/role to keep
the dashboard snappy and avoid COUNT(*) thrash on large tenants.
"""
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate, TruncHour, TruncWeek, TruncMonth
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdminRoleOrSuperuser, IsLecturerOrAdmin

STALE_SECONDS = 60


def _tenant_cache_key(user, suffix: str) -> str:
    tid = getattr(user, "tenant_id", None) or "none"
    return f"dashboard:{tid}:{user.role}:{suffix}:v1"


# ----------------------------------------------------------------------
# Student dashboard
# ----------------------------------------------------------------------
@extend_schema(
    tags=["Dashboard"],
    summary="Student dashboard aggregates",
    description=(
        "Returns everything the student dashboard needs in one call: "
        "enrollment count, bookmark/note/quiz-attempt counts, recent "
        "chat sessions, recently-updated course resources, quick links."
    ),
)
class StudentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.tenant_id:
            return Response(self._empty())
        key = _tenant_cache_key(user, "student")
        data = cache.get(key)
        if data is not None:
            return Response(data)
        data = self._build(user)
        cache.set(key, data, STALE_SECONDS)
        return Response(data)

    @staticmethod
    def _empty():
        return {
            "counts": {},
            "enrolled_courses": [],
            "recent_resources": [],
            "recent_chats": [],
            "quiz_attempts": 0,
            "next_deadline": None,
        }

    @staticmethod
    def _build(user):
        from apps.academics.models import (
            Course, CourseEnrollment, CourseOffering,
        )
        from apps.resources.models import Resource
        from apps.chat.models import ChatSession
        from apps.assessments.models import QuizAttempt
        from apps.learning.models import Note, Bookmark

        tenant_id = user.tenant_id

        # Counts
        enrolled_qs = CourseEnrollment.objects.filter(
            student=user, status=CourseEnrollment.Status.ENROLLED,
        )
        enrollments_count = enrolled_qs.count()

        notes_count = Note.objects.filter(tenant_id=tenant_id, user=user).count()
        bookmarks_count = Bookmark.objects.filter(tenant_id=tenant_id, user=user).count()
        attempts_count = QuizAttempt.objects.filter(
            tenant_id=tenant_id, student=user,
        ).count()
        chat_count = ChatSession.objects.filter(
            tenant_id=tenant_id, user=user,
        ).count()

        # Enrolled courses (most recent 5)
        enrolled_courses = list(
            enrolled_qs.select_related(
                "course_offering__course",
                "course_offering__semester",
            )
            .order_by("-enrolled_at")[:5]
            .values(
                "course_offering__course__id",
                "course_offering__course__code",
                "course_offering__course__title",
                "course_offering__semester__name",
            )
        )
        enrolled_courses = [
            {
                "id": c["course_offering__course__id"],
                "code": c["course_offering__course__code"],
                "title": c["course_offering__course__title"],
                "semester": c["course_offering__semester__name"],
            }
            for c in enrolled_courses
        ]

        # My resources: visible within enrolled offerings + broader scopes
        offering_ids = list(
            enrolled_qs.values_list("course_offering_id", flat=True),
        )
        res_qs = Resource.objects.filter(
            tenant_id=tenant_id,
            processing_status=Resource.ProcessingStatus.READY,
        ).filter(
            Q(course_offering_id__in=offering_ids)
            | Q(visibility_scope__in=[
                Resource.Visibility.DEPARTMENT,
                Resource.Visibility.PROGRAMME,
                Resource.Visibility.FACULTY,
                Resource.Visibility.INSTITUTION,
            ]),
        )
        resources_count = res_qs.count()
        recent_resources = list(
            res_qs.order_by("-updated_at")[:6].values(
                "id", "title", "mime_type", "updated_at", "visibility_scope",
            )
        )

        # Recent chats
        recent_chats = list(
            ChatSession.objects.filter(tenant_id=tenant_id, user=user)
            .order_by("-updated_at")[:5]
            .values("id", "title", "updated_at")
        )

        return {
            "counts": {
                "enrollments": enrollments_count,
                "resources": resources_count,
                "notes": notes_count,
                "bookmarks": bookmarks_count,
                "quiz_attempts": attempts_count,
                "chats": chat_count,
            },
            "enrolled_courses": enrolled_courses,
            "recent_resources": [
                {**r, "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None}
                for r in recent_resources
            ],
            "recent_chats": [
                {**c, "updated_at": c["updated_at"].isoformat() if c["updated_at"] else None}
                for c in recent_chats
            ],
        }


# ----------------------------------------------------------------------
# Admin / Lecturer dashboard (tenant-scoped)
# ----------------------------------------------------------------------
@extend_schema(
    tags=["Dashboard"],
    summary="Tenant admin/lecturer dashboard aggregates",
    description=(
        "Returns every count and chart series the institution dashboard "
        "needs (users by role, resource pipeline, academic structure, "
        "quiz and chat activity). A single cached request replaces the "
        "15+ list calls the frontend used to fire."
    ),
)
class AdminDashboardView(APIView):
    permission_classes = [IsLecturerOrAdmin]

    def get(self, request):
        user = request.user
        if not user.tenant_id:
            return Response(self._empty())
        key = _tenant_cache_key(user, "admin")
        data = cache.get(key)
        if data is not None:
            return Response(data)
        data = self._build(user)
        cache.set(key, data, STALE_SECONDS)
        return Response(data)

    @staticmethod
    def _empty():
        return {"totals": {}, "users_by_role": [], "materials_by_status": [],
                "structure": [], "recent_activity": []}

    @staticmethod
    def _build(user):
        from apps.accounts.models import User
        from apps.academics.models import (
            Course, CourseEnrollment, CourseOffering, Department,
            Faculty, Programme,
        )
        from apps.resources.models import Resource
        from apps.chat.models import ChatMessage, ChatSession
        from apps.assessments.models import Quiz, QuizAttempt

        tid = user.tenant_id

        def cnt(model, **filters):
            return model.objects.filter(tenant_id=tid, **filters).count()

        # Users by role
        role_rows = list(
            User.objects.filter(tenant_id=tid)
            .values("role")
            .annotate(count=Count("id"))
        )
        role_map = {r["role"]: r["count"] for r in role_rows}
        users_total = sum(role_map.values())

        # Resources pipeline
        status_rows = list(
            Resource.objects.filter(tenant_id=tid)
            .values("processing_status")
            .annotate(count=Count("id"))
        )
        status_map = {r["processing_status"]: r["count"] for r in status_rows}
        res_total = sum(status_map.values())
        storage_used = (
            Resource.objects.filter(tenant_id=tid)
            .aggregate(total=Sum("versions__file_size_bytes"))["total"] or 0
        )

        # Academic structure
        structure = [
            {"name": "Faculties", "value": cnt(Faculty)},
            {"name": "Departments", "value": cnt(Department)},
            {"name": "Programmes", "value": cnt(Programme)},
            {"name": "Courses", "value": cnt(Course)},
            {"name": "Offerings", "value": cnt(CourseOffering)},
        ]

        enrollments = cnt(CourseEnrollment)
        quizzes = cnt(Quiz)
        attempts = QuizAttempt.objects.filter(quiz__tenant_id=tid).count()
        sessions = cnt(ChatSession)
        messages = ChatMessage.objects.filter(
            tenant_id=tid, role=ChatMessage.Role.USER,
        ).count()

        # Recent activity: last 8 resources uploaded. Private materials appear
        # only if the current user is their uploader.
        recent_resources = list(
            Resource.objects.filter(tenant_id=tid)
            .filter(
                ~Q(visibility_scope=Resource.Visibility.PRIVATE)
                | Q(
                    visibility_scope=Resource.Visibility.PRIVATE,
                    uploaded_by_id=user.id,
                )
            )
            .select_related("uploaded_by")
            .order_by("-created_at")[:8]
            .values(
                "id", "title", "processing_status", "mime_type",
                "created_at", "uploaded_by__first_name",
                "uploaded_by__last_name", "uploaded_by__email",
            )
        )

        def _res(r):
            name = ""
            fn = r.get("uploaded_by__first_name") or ""
            ln = r.get("uploaded_by__last_name") or ""
            email = r.get("uploaded_by__email") or ""
            if fn or ln:
                name = f"{fn} {ln}".strip()
            else:
                name = email
            return {
                "id": r["id"],
                "title": r["title"],
                "status": r["processing_status"],
                "mime_type": r["mime_type"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "uploaded_by": name,
            }

        return {
            "totals": {
                "users": users_total,
                "resources": res_total,
                "storage_used_bytes": storage_used,
                "enrollments": enrollments,
                "quizzes": quizzes,
                "quiz_attempts": attempts,
                "chat_sessions": sessions,
                "chat_messages": messages,
            },
            "users_by_role": [
                {"name": "Students", "value": role_map.get("student", 0)},
                {"name": "Lecturers", "value": role_map.get("lecturer", 0)},
                {"name": "Admins", "value": role_map.get("admin", 0)},
            ],
            "materials_by_status": [
                {"name": "Ready", "value": status_map.get("ready", 0)},
                {"name": "Processing", "value": status_map.get("processing", 0)},
                {"name": "Pending", "value": status_map.get("pending", 0)},
                {"name": "Failed", "value": status_map.get("failed", 0)},
            ],
            "structure": structure,
            "recent_resources": [_res(r) for r in recent_resources],
        }


# ----------------------------------------------------------------------
# Student activity timeline (for the chart widget)
# ----------------------------------------------------------------------
@extend_schema(
    tags=["Dashboard"],
    summary="Student activity timeline",
    description=(
        "Returns time-bucketed counts of study actions (chat messages, "
        "notes, bookmarks, quiz attempts, resource accesses) for the "
        "calling student. ?range=hour|day|week|month controls bucket size "
        "and window length. Defaults to 'day' (last 14 days)."
    ),
)
class StudentActivityView(APIView):
    permission_classes = [IsAuthenticated]

    RANGE_CONFIG = {
        # range -> (trunc, window_days, label_format)
        "hour": (TruncHour, 2, "%H:%M"),
        "day": (TruncDate, 14, "%b %d"),
        "week": (TruncWeek, 60, "%b %d"),
        "month": (TruncMonth, 365, "%b %Y"),
    }

    def get(self, request):
        rng = request.query_params.get("range", "day").lower()
        if rng not in self.RANGE_CONFIG:
            rng = "day"
        trunc_fn, window_days, _label = self.RANGE_CONFIG[rng]
        user = request.user
        tid = user.tenant_id
        since = timezone.now() - timedelta(days=window_days)

        def _series(qs, date_field):
            return list(
                qs.annotate(bucket=trunc_fn(date_field))
                .filter(bucket__gte=since)
                .values("bucket")
                .annotate(count=Count("id"))
                .order_by("bucket")
            )

        from apps.chat.models import ChatMessage
        from apps.assessments.models import QuizAttempt
        from apps.learning.models import Note

        chat_series = _series(
            ChatMessage.objects.filter(
                tenant_id=tid, session__user=user, role=ChatMessage.Role.USER,
            ),
            "created_at",
        )
        quiz_series = _series(
            QuizAttempt.objects.filter(tenant_id=tid, student=user),
            "started_at",
        )
        note_series = _series(
            Note.objects.filter(tenant_id=tid, user=user),
            "created_at",
        )

        # Build a merged sorted list of buckets
        buckets = {}

        def _merge(series, key):
            for row in series:
                b = row["bucket"]
                if b is None:
                    continue
                # TruncHour/TruncDate/... are tz-aware datetimes or dates.
                # Normalize to ISO for the frontend.
                iso = b.isoformat() if hasattr(b, "isoformat") else str(b)
                if iso not in buckets:
                    buckets[iso] = {"bucket": iso, "chats": 0, "quizzes": 0, "notes": 0}
                buckets[iso][key] = row["count"]

        _merge(chat_series, "chats")
        _merge(quiz_series, "quizzes")
        _merge(note_series, "notes")

        timeline = sorted(buckets.values(), key=lambda x: x["bucket"])
        return Response(
            {
                "range": rng,
                "window_days": window_days,
                "timeline": timeline,
                "totals": {
                    "chats": sum(r["chats"] for r in timeline),
                    "quizzes": sum(r["quizzes"] for r in timeline),
                    "notes": sum(r["notes"] for r in timeline),
                },
            }
        )


# ----------------------------------------------------------------------
# Admin audit summary (aggregate analytics over audit logs)
# ----------------------------------------------------------------------
@extend_schema(
    tags=["Dashboard"],
    summary="Tenant admin audit/activity analytics",
    description=(
        "Aggregate counts over audit logs for the admin/lecturer "
        "dashboard: actions over time, top actors, top entity types, "
        "recent events. Cached 60s."
    ),
)
class AdminAuditSummaryView(APIView):
    permission_classes = [IsLecturerOrAdmin]

    def get(self, request):
        user = request.user
        tid = user.tenant_id
        try:
            days = int(request.query_params.get("days", "14"))
        except (TypeError, ValueError):
            days = 14
        days = max(1, min(days, 90))
        key = f"dashboard:{tid}:admin-audit-summary:{days}:v1"
        data = cache.get(key)
        if data is not None:
            return Response(data)
        data = self._build(tid, days)
        cache.set(key, data, STALE_SECONDS)
        return Response(data)

    @staticmethod
    def _build(tid, days):
        from apps.audit.models import AuditLog

        since = timezone.now() - timedelta(days=days)

        base = AuditLog.objects.filter(tenant_id=tid, created_at__gte=since)

        # Actions by day
        by_day = list(
            base.annotate(bucket=TruncDate("created_at"))
            .values("bucket")
            .annotate(count=Count("id"))
            .order_by("bucket")
        )
        timeline = [
            {"bucket": r["bucket"].isoformat() if r["bucket"] else None, "count": r["count"]}
            for r in by_day if r["bucket"]
        ]

        # By action category
        by_action = list(
            base.values("action").annotate(count=Count("id")).order_by("-count")[:10]
        )

        # By entity type
        by_entity = list(
            base.values("entity_type").annotate(count=Count("id")).order_by("-count")[:8]
        )

        # Top actors
        by_actor = list(
            base.values("actor__first_name", "actor__last_name", "actor__email")
            .annotate(count=Count("id"))
            .order_by("-count")[:8]
        )
        actors = []
        for a in by_actor:
            fn = a.get("actor__first_name") or ""
            ln = a.get("actor__last_name") or ""
            name = f"{fn} {ln}".strip() or a.get("actor__email") or "Unknown"
            actors.append({"name": name, "count": a["count"]})

        recent = list(
            base.select_related("actor")
            .order_by("-created_at")[:10]
            .values(
                "id", "action", "entity_type", "entity_id",
                "created_at",
                "actor__first_name", "actor__last_name", "actor__email",
            )
        )
        recent_events = []
        for e in recent:
            fn = e.get("actor__first_name") or ""
            ln = e.get("actor__last_name") or ""
            name = f"{fn} {ln}".strip() or e.get("actor__email") or "System"
            recent_events.append(
                {
                    "id": e["id"],
                    "action": e["action"],
                    "entity_type": e["entity_type"],
                    "entity_id": e["entity_id"],
                    "created_at": e["created_at"].isoformat() if e["created_at"] else None,
                    "actor": name,
                }
            )

        return {
            "window_days": days,
            "total_events": base.count(),
            "timeline": timeline,
            "by_action": [
                {"name": r["action"], "count": r["count"]} for r in by_action
            ],
            "by_entity_type": [
                {"name": r["entity_type"] or "unknown", "count": r["count"]} for r in by_entity
            ],
            "top_actors": actors,
            "recent": recent_events,
        }

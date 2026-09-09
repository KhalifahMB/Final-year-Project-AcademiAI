"""
Tenant log viewing endpoints (tenant_admin only).
"""
from collections import Counter

from django.db.models import Avg
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from .models import TenantLog
from .serializers import TenantLogSerializer


class IsTenantAdmin(BasePermission):
    """Only tenant admins can view logs."""

    def has_permission(self, request, view):
        user = request.user
        return (
            user
            and user.is_authenticated
            and getattr(user, "role", None) in ("tenant_admin",)
            and getattr(user, "tenant_id", None) is not None
        )


@extend_schema(tags=["Logs"])
class TenantLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view of tenant logs. Tenant admins only.
    Supports filtering by level, category, action, date range, actor.
    """

    serializer_class = TenantLogSerializer
    permission_classes = [IsTenantAdmin]

    def _base_queryset(self):
        """Filtered (but unsliced) queryset; the analyze action needs the
        full set to aggregate accurately, while the read endpoints cap at
        1000 rows for response size."""
        if getattr(self, "swagger_fake_view", False):
            return TenantLog.objects.none()

        qs = TenantLog.objects.filter(tenant_id=self.request.user.tenant_id)

        level = self.request.query_params.get("level")
        if level:
            qs = qs.filter(level=level)

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)

        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action__icontains=action)

        actor_id = self.request.query_params.get("actor_id")
        if actor_id:
            qs = qs.filter(actor_id=actor_id)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(action__icontains=search)
                | Q(request_path__icontains=search)
                | Q(actor_email__icontains=search)
            )

        return qs.select_related()

    def get_queryset(self):
        return self._base_queryset().order_by("-timestamp")[:1000]

    @action(detail=False, methods=["get"], url_path="analyze")
    def analyze(self, request):
        """Return aggregate analytics over the tenant's audit-log window.

        Aggregates log volume by category/level/action, counts active actors,
        error rate, and response-time stats. Useful for the admin
        "system health / log analyzer" surface.
        """
        base = self._base_queryset()

        total = base.count()
        if total == 0:
            return Response({
                "total": 0,
                "by_category": [],
                "by_level": [],
                "top_actions": [],
                "active_actors": 0,
                "error_count": 0,
                "error_rate": 0,
                "avg_response_time_ms": None,
                "p95_response_time_ms": None,
                "recent_errors": [],
            })

        by_category = Counter()
        by_level = Counter()
        by_action = Counter()
        error_rows = []
        response_times = []

        for row in base.iterator():
            by_category[row.category] += 1
            by_level[row.level] += 1
            by_action[row.action] += 1
            if row.level in ("error", "warning"):
                error_rows.append(row)
            if row.response_time_ms:
                response_times.append(row.response_time_ms)

        def _pct(value):
            return round(value / total * 100, 1)

        def _series(counter):
            return [
                {"name": key, "value": value, "pct": _pct(value)}
                for key, value in counter.most_common()
            ]

        avg_rt = round(sum(response_times) / len(response_times), 1) if response_times else None
        if response_times:
            response_times.sort()
            p95_index = max(0, int(round(len(response_times) * 0.95)) - 1)
            p95 = response_times[min(p95_index, len(response_times) - 1)]
        else:
            p95 = None

        recent_errors = [
            {
                "level": row.level,
                "action": row.action,
                "category": row.category,
                "timestamp": row.timestamp,
                "request_path": row.request_path,
                "response_status_code": row.response_status_code,
            }
            for row in sorted(error_rows, key=lambda r: r.timestamp, reverse=True)[:20]
        ]

        active_actors = base.exclude(actor_id__isnull=True).values("actor_id").distinct().count()
        error_count = len([r for r in error_rows if r.level == "error"])

        return Response({
            "total": total,
            "by_category": _series(by_category),
            "by_level": _series(by_level),
            "top_actions": _series(by_action),
            "active_actors": active_actors,
            "error_count": error_count,
            "error_rate": round(error_count / total * 100, 1) if total else 0,
            "avg_response_time_ms": avg_rt,
            "p95_response_time_ms": p95,
            "recent_errors": recent_errors,
        })

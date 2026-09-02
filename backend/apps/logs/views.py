"""
Tenant log viewing endpoints (tenant_admin only).
"""
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.permissions import BasePermission

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

    def get_queryset(self):
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

        return qs.select_related().order_by("-timestamp")[:1000]

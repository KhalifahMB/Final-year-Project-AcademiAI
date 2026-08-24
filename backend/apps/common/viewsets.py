"""
Tenant-aware ModelViewSet bases.
"""
from rest_framework import viewsets

from apps.common.permissions import IsAdminRole, IsTenantMember, TenantObjectPermission


class TenantModelViewSet(viewsets.ModelViewSet):
    """
    Automatically scopes queryset to request.user.tenant
    and enforces object-level tenant match.
    """

    permission_classes = [IsTenantMember, TenantObjectPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id is None:
            return qs.none()
        if hasattr(qs.model, "tenant_id"):
            return qs.filter(tenant_id=tenant_id)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(tenant=user.tenant)


class AdminWriteViewSet(TenantModelViewSet):
    """
    All authenticated tenant members may read; only Admins may create,
    update or delete. Used for institutional/academic structure endpoints.
    """

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminRole()] + perms
        return perms

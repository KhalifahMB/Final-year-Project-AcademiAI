"""
Tenant-aware ModelViewSet base.
"""
from rest_framework import viewsets

from apps.common.permissions import IsTenantMember, TenantObjectPermission


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

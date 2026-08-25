from drf_spectacular.utils import extend_schema
from rest_framework import viewsets

from apps.common.permissions import IsAdminRole
from .models import Tenant
from .serializers import TenantSerializer


@extend_schema(tags=["Tenants"])
class TenantViewSet(viewsets.ModelViewSet):
    """
    Tenant CRUD. Reads are limited to the caller's own tenant
    (superusers may list all). Writes require the Admin role.
    """

    queryset = Tenant.objects.none()
    serializer_class = TenantSerializer
    search_fields = ["name", "slug"]
    lookup_field = "id"

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminRole()] + perms
        return perms

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Tenant.objects.none()
        user = self.request.user
        if user.is_superuser:
            return Tenant.objects.all()
        if user.tenant_id:
            return Tenant.objects.filter(id=user.tenant_id)
        return Tenant.objects.none()

from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets

from apps.common.permissions import IsAdminRole, IsTenantMember
from .models import AuditLog
from .serializers import AuditLogSerializer


@extend_schema(
    tags=["Administration"],
    description=(
        "Read-only, append-only security audit trail for the tenant. "
        "Visible to Admins only; no update or delete endpoints exist by design."
    ),
)
class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.none()
    serializer_class = AuditLogSerializer
    permission_classes = [IsTenantMember, IsAdminRole]
    filterset_fields = ["action", "entity_type"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AuditLog.objects.none()
        return AuditLog.objects.filter(tenant=self.request.user.tenant).select_related("actor")

from rest_framework import mixins, viewsets
from apps.common.permissions import IsAdminRole, IsTenantMember
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsTenantMember, IsAdminRole]
    filterset_fields = ["action", "entity_type"]

    def get_queryset(self):
        return AuditLog.objects.filter(tenant=self.request.user.tenant)

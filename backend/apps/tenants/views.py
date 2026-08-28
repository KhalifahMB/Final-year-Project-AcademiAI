from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsSuperuser
from .models import Tenant
from .serializers import (
    TenantSerializer,
    PlatformTenantSerializer,
    TenantDirectorySerializer,
)


@extend_schema(
    tags=["Tenants"],
    summary="Browse active institutions",
    description=(
        "Public, non-sensitive directory of ACTIVE institutions for the "
        "signup dropdown and landing-page search. Exposes only id, name "
        "and slug; supports ?search= filtering."
    ),
    auth=[],
)
class TenantDirectoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Tenant.objects.filter(status=Tenant.Status.ACTIVE).order_by("name")
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(slug__icontains=search)
        limit = min(int(request.query_params.get("limit", 100) or 100), 200)
        data = TenantDirectorySerializer(qs[:limit], many=True).data
        return Response({"count": len(data), "results": data})


@extend_schema(tags=["Tenants"])
class TenantViewSet(viewsets.ModelViewSet):
    """
    Tenant CRUD. Reads are limited to the caller's own tenant
    (superusers may list all). Creation and destruction are platform
    provisioning concerns handled exclusively via tenant-request approval, so
    this view does not expose POST or DELETE. Updates (status suspension /
    reactivation) are reserved for the platform superuser; all other tenant
    details are read-only.
    """

    serializer_class = TenantSerializer
    search_fields = ["name", "slug"]
    lookup_field = "id"
    # Tenants are created and removed exclusively through tenant-request
    # approval, never via a generic CRUD route — so POST and DELETE are
    # disabled here (DRF returns 405 for them).
    http_method_names = ["get", "patch", "head", "options"]

    def get_permissions(self):
        # Only the platform superuser may suspend/reactivate a tenant.
        # No role (admin/lecturer/student) may edit tenant records otherwise.
        if self.action in ("update", "partial_update"):
            return [IsSuperuser()]
        return []

    def get_serializer_class(self):
        user = getattr(self.request, "user", None)
        if user is not None and getattr(user, "is_superuser", False):
            return PlatformTenantSerializer
        return TenantSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Tenant.objects.none()
        user = self.request.user
        if user.is_superuser:
            return Tenant.objects.all()
        if user.tenant_id:
            return Tenant.objects.filter(id=user.tenant_id)
        return Tenant.objects.none()

    def perform_update(self, serializer):
        # Slug is immutable after provisioning (subdomain compatibility).
        serializer.validated_data.pop("slug", None)
        old_status = serializer.instance.status
        tenant = serializer.save()
        new_status = tenant.status
        if new_status == old_status:
            return

        from django.utils import timezone

        if new_status == Tenant.Status.SUSPENDED:
            # Grace period starts now; a scheduled task disables logins
            # after 24h. Users are warned immediately by email.
            tenant.suspended_at = timezone.now()
            tenant.save(update_fields=["suspended_at", "updated_at"])
            try:
                from apps.accounts.tasks import send_tenant_suspension_emails

                send_tenant_suspension_emails.delay(str(tenant.id))
            except Exception:
                pass  # logged inside the task
        elif new_status == Tenant.Status.ACTIVE and old_status == Tenant.Status.SUSPENDED:
            # Reactivation: restore access for everyone the restriction
            # task had disabled.
            tenant.suspended_at = None
            tenant.save(update_fields=["suspended_at", "updated_at"])
            from apps.accounts.services import reactivate_tenant_users

            reactivate_tenant_users(tenant)

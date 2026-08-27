from django.db import models as django_models
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsSuperuser
from .models import Announcement
from .serializers import AnnouncementSerializer, AnnouncementPublicSerializer


@extend_schema(
    tags=["Platform"],
    summary="Platform announcements (superuser CRUD)",
)
class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.none()
    serializer_class = AnnouncementSerializer
    permission_classes = [IsSuperuser]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Announcement.objects.none()
        return Announcement.objects.select_related("created_by").prefetch_related("target_tenants")


@extend_schema(
    tags=["Platform"],
    summary="Active announcements for a tenant",
    description="Public. Returns active announcements targeting this tenant or all tenants.",
    auth=[],
)
class TenantAnnouncementsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        from apps.tenants.models import Tenant

        slug = request.query_params.get("tenant_slug", "").strip()
        if not slug:
            return Response({"results": []})

        try:
            tenant = Tenant.objects.get(slug=slug, status=Tenant.Status.ACTIVE)
        except Tenant.DoesNotExist:
            return Response({"results": []})

        qs = Announcement.objects.filter(is_active=True).filter(
            django_models.Q(target=Announcement.Target.ALL)
            | django_models.Q(target_tenants=tenant)
        ).distinct().order_by("-created_at")[:20]

        data = AnnouncementPublicSerializer(qs, many=True).data
        return Response({"results": data})

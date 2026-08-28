from django.db import models as django_models
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsSuperuser
from .models import Announcement, AnnouncementSubscription
from .serializers import (
    AnnouncementSerializer,
    AnnouncementPublicSerializer,
    AnnouncementSubscriptionSerializer,
    AnnouncementSubscriptionInputSerializer,
)
import logging

logger = logging.getLogger(__name__)


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

    def perform_create(self, serializer):
        announcement = serializer.save()
        try:
            from .tasks import dispatch_announcement_emails

            dispatch_announcement_emails.delay(str(announcement.id))
        except Exception:
            logger.exception("Failed to queue announcement emails id=%s", announcement.id)


@extend_schema(
    tags=["Platform"],
    summary="Current user announcement email preferences",
    description=(
        "Authenticated user's announcement subscription. Only the 'info' "
        "type can be toggled; important (warning/critical) announcements are "
        "always emailed."
    ),
)
class AnnouncementSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pref, _ = AnnouncementSubscription.objects.get_or_create(user=request.user)
        return Response(AnnouncementSubscriptionSerializer(pref).data)

    def put(self, request):
        pref, _ = AnnouncementSubscription.objects.get_or_create(user=request.user)
        input_ser = AnnouncementSubscriptionInputSerializer(data=request.data)
        input_ser.is_valid(raise_exception=True)
        pref.subscribe_info = input_ser.validated_data["subscribe_info"]
        pref.save(update_fields=["subscribe_info", "updated_at"])
        return Response(AnnouncementSubscriptionSerializer(pref).data)


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

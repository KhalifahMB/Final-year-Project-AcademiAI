from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.pagination import DefaultPagination
from apps.common.permissions import IsTenantMember
from .models import Notification
from .serializers import NotificationSerializer
from . import services


@extend_schema(
    tags=["Notifications"],
    summary="List my notifications",
    description=(
        "Refreshes the caller's feed from live in-app state, then returns "
        "their notifications plus an `unread_count` (unread warnings + "
        "critical alerts) for badge rendering."
    ),
)
class NotificationListView(APIView):
    permission_classes = [IsTenantMember]

    def get(self, request):
        user = request.user
        services.sync_user_notifications(user)
        queryset = Notification.objects.filter(
            tenant_id=user.tenant_id,
            user=user,
        )
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request)
        data = paginator.get_paginated_response(
            NotificationSerializer(page, many=True).data
        ).data
        data["unread_count"] = Notification.objects.filter(
            tenant_id=user.tenant_id,
            user=user,
            is_read=False,
            severity__in=services.BADGE_SEVERITIES,
        ).count()
        return Response(data)


@extend_schema(
    tags=["Notifications"],
    summary="Unread notification count",
    description="Cheap badge endpoint: syncs alerts and returns unread WARN/CRITICAL count.",
)
class NotificationUnreadCountView(APIView):
    permission_classes = [IsTenantMember]

    def get(self, request, *args, **kwargs):
        user = request.user
        return Response({"unread_count": services.unread_alert_count(user)})


@extend_schema(
    tags=["Notifications"],
    summary="Mark one notification as read",
    request=None,
)
class NotificationMarkReadView(APIView):
    permission_classes = [IsTenantMember]

    def post(self, request, pk, *args, **kwargs):
        user = request.user
        try:
            UUID(str(pk))
        except (ValueError, AttributeError):
            return Response(
                {"detail": "Invalid notification id."}, status=status.HTTP_400_BAD_REQUEST
            )
        if not services.mark_read(user, pk):
            return Response(
                {"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response({"ok": True})


@extend_schema(
    tags=["Notifications"],
    summary="Mark all notifications as read",
    request=None,
)
class NotificationMarkAllReadView(APIView):
    permission_classes = [IsTenantMember]

    def post(self, request, *args, **kwargs):
        user = request.user
        updated = services.mark_all_read(user)
        return Response({"ok": True, "updated": updated})
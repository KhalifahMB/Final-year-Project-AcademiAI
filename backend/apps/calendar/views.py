"""
Calendar views: layered, role-aware access to CalendarEvent and
CalendarSchedule, plus ICS export.

RBAC model:
- Students see personal events (their plans), academic lectures for their
  enrolled course offerings, and exams for their course offerings.
- Lecturers see academic lectures for their assigned offerings + office
  hours events they created.
- Tenant admins see everything in the tenant incl. the institution layer,
  and may create institution-wide events.
"""
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.common.permissions import IsAdminRole, IsTenantMember
from apps.common.viewsets import TenantModelViewSet

from .models import CalendarEvent, CalendarSchedule, CalendarLayer
from .serializers import (
    CalendarEventSerializer,
    CalendarEventListSerializer,
    CalendarScheduleSerializer,
)


def _visible_events_q(user):
    """
    Queryset expression selecting events the given user may SEE, based on
    role. RLS still applies at the DB layer; this is app-layer RBAC on top.
    """
    q = Q()
    if user.role == "student":
        from apps.academics.models import CourseEnrollment

        offering_ids = CourseEnrollment.objects.filter(
            tenant=user.tenant, student=user,
            status=CourseEnrollment.Status.ENROLLED,
        ).values_list("course_offering_id", flat=True)

        q = (
            Q(user=user)
            | Q(layer=CalendarLayer.ACADEMIC, course_offering_id__in=offering_ids)
            | Q(layer=CalendarLayer.EXAMS, course_offering_id__in=offering_ids)
            | Q(layer=CalendarLayer.INSTITUTION, visibility="tenant")
        )
    elif user.role == "lecturer":
        from apps.academics.models import LecturerCourseAssignment

        offering_ids = LecturerCourseAssignment.objects.filter(
            tenant=user.tenant, lecturer=user,
        ).values_list("course_offering_id", flat=True)

        q = (
            Q(user=user)
            | Q(layer=CalendarLayer.ACADEMIC, course_offering_id__in=offering_ids)
            | Q(layer=CalendarLayer.OFFICE_HOURS, user=user)
            | Q(layer=CalendarLayer.INSTITUTION, visibility="tenant")
        )
    else:
        # tenant_admin sees everything in their tenant.
        q = Q()
    return q


def _parse_bool(value, default=False):
    if value is None:
        return default
    return str(value).lower() in ("1", "true", "yes", "on")


@extend_schema(tags=["Calendar"])
class CalendarEventViewSet(TenantModelViewSet):
    """
    Calendar events with role-based layered access.

    Query params:
    - `start` / `end` (ISO datetimes) to filter a range.
    - `layer` to filter to a single layer.
    - `view` = month|week|day|agenda (agenda returns upcoming events).
    """
    serializer_class = CalendarEventSerializer
    filterset_fields = ["layer", "event_type"]
    search_fields = ["title", "description", "venue", "course_code"]

    def get_queryset(self):
        qs = (super().get_queryset()
              .select_related("course_offering", "plan", "user", "created_by"))
        user = self.request.user
        qs = qs.filter(_visible_events_q(user))

        layer = self.request.query_params.get("layer")
        if layer:
            qs = qs.filter(layer=layer)

        # Role: students may only write to personal + plan-linked events.
        # Lecturers may create personal events + office hours.
        # Admins may create anything incl. institution-wide.
        if self.action in ("create", "update", "partial_update", "destroy"):
            if not (user.role == "tenant_admin" or user.role == "lecturer"):
                # students: restrict write to personal layer
                qs = qs.filter(layer=CalendarLayer.PERSONAL)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        layer = serializer.validated_data.get("layer", CalendarLayer.PERSONAL)
        # Enforce role-based defaults for institution-wide events.
        if layer == CalendarLayer.INSTITUTION:
            if user.role != "tenant_admin" and not user.is_superuser:
                raise PermissionError("Only tenant admins can create institution-wide events.")
            serializer.save(
                tenant=user.tenant,
                created_by=user,
                visibility="tenant",
            )
        elif layer == CalendarLayer.OFFICE_HOURS:
            if user.role not in ("lecturer", "tenant_admin"):
                raise PermissionError("Only lecturers and admins can create office hours.")
            serializer.save(tenant=user.tenant, created_by=user, user=user)
        else:
            serializer.save(tenant=user.tenant, created_by=user, user=user)

    def list(self, request, *args, **kwargs):
        # If client only asks for lightweight grid data, use the list serializer.
        lightweight = _parse_bool(request.query_params.get("light"))
        if lightweight:
            qs = self.filter_queryset(self.get_queryset())
            start = request.query_params.get("start")
            end = request.query_params.get("end")
            if start:
                from django.utils.dateparse import parse_datetime
                dt = parse_datetime(start)
                if dt:
                    qs = qs.filter(start__gte=dt)
            if end:
                from django.utils.dateparse import parse_datetime
                dt = parse_datetime(end)
                if dt:
                    qs = qs.filter(start__lte=dt)
            page = self.paginate_queryset(qs)
            serializer = CalendarEventListSerializer(page if page is not None else qs, many=True)
            if page is not None:
                return self.get_paginated_response(serializer.data)
            return Response(serializer.data)
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="upcoming")
    def upcoming(self, request):
        """Return the next N events (agenda-style)."""
        qs = self.filter_queryset(self.get_queryset())
        now = timezone.now()
        qs = qs.filter(
            Q(end__isnull=True, start__gte=now) | Q(end__gte=now),
            status__in=[CalendarEvent.EventStatus.CONFIRMED, CalendarEvent.EventStatus.TENTATIVE],
        ).order_by("start")
        limit = min(int(request.query_params.get("limit", 10)), 50)
        serializer = CalendarEventListSerializer(qs[:limit], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        """Return all visible events as an .ics download."""
        from .services.ics import build_ics

        qs = self.filter_queryset(self.get_queryset())
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        import django.utils.dateparse as dp
        if start:
            dt = dp.parse_datetime(start)
            if dt:
                qs = qs.filter(start__gte=dt)
        if end:
            dt = dp.parse_datetime(end)
            if dt:
                qs = qs.filter(start__lte=dt)
        qs = qs.order_by("start")

        calendar_name = f"{self.request.user.full_name} - AcademiAI Calendar"
        payload = build_ics(qs, calendar_name)
        response = HttpResponse(payload, content_type="text/calendar; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="academiai-calendar.ics"'
        return response


@extend_schema(tags=["Calendar"])
class CalendarScheduleViewSet(TenantModelViewSet):
    """Manage bulk-imported timetables (admin upload wizard)."""
    serializer_class = CalendarScheduleSerializer
    permission_classes = [IsTenantMember]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        if user.role == "tenant_admin":
            return qs
        # Lecturers may view schedules for their department; students none.
        if user.role == "lecturer":
            lecturer_profile = getattr(user, "lecturer_profile", None)
            dept = getattr(lecturer_profile, "department_id", None)
            if dept:
                return qs.filter(Q(department_id=dept) | Q(department__isnull=True))
            return qs.filter(department__isnull=True)
        return qs.none()

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminRole()] + perms
        return perms

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            uploaded_by=self.request.user,
        )

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
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.common.permissions import IsAdminRole, IsTenantMember
from apps.common.viewsets import TenantModelViewSet

from .models import CalendarEvent, CalendarSchedule, CalendarLayer, EventStatus
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
    queryset = CalendarEvent.objects.all()
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
                raise PermissionDenied("Only tenant admins can create institution-wide events.")
            serializer.save(
                tenant=user.tenant,
                created_by=user,
                visibility="tenant",
            )
        elif layer == CalendarLayer.OFFICE_HOURS:
            if user.role not in ("lecturer", "tenant_admin"):
                raise PermissionDenied("Only lecturers and admins can create office hours.")
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

    @action(detail=False, methods=["get"], url_path="layers")
    def layers(self, request):
        """Return the full layer catalogue plus the role's default active set.

        The frontend uses ``default_layers`` to initialise which calendar
        layers are toggled for the signed-in user's role.
        """
        all_layers = [{"key": value, "label": label} for value, label in CalendarLayer.choices]
        defaults = {
            "student": ["personal", "academic", "exams", "institution"],
            "lecturer": ["personal", "academic", "office_hours", "institution"],
            "tenant_admin": [value for value, _ in CalendarLayer.choices],
        }
        role = request.user.role if not request.user.is_superuser else "tenant_admin"
        return Response({
            "all_layers": all_layers,
            "default_layers": defaults.get(role, defaults["student"]),
        })

    @action(detail=False, methods=["get"], url_path="upcoming")
    def upcoming(self, request):
        """Return the next N events (agenda-style)."""
        qs = self.filter_queryset(self.get_queryset())
        now = timezone.now()
        qs = qs.filter(
            Q(end__isnull=True, start__gte=now) | Q(end__gte=now),
            status__in=[EventStatus.CONFIRMED, EventStatus.TENTATIVE],
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
    queryset = CalendarSchedule.objects.select_related("uploaded_by")
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
        if self.action in (
            "create", "update", "partial_update", "destroy",
            "preview", "preview_commit", "template",
        ):
            return [IsAdminRole()] + perms
        return perms

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.user.tenant,
            uploaded_by=self.request.user,
        )

    @action(detail=False, methods=["get"], url_path="template")
    def template(self, request):
        """Download a CSV template for timetable uploads."""
        from .services.schedule_parse import template_csv_bytes

        content = template_csv_bytes()
        response = HttpResponse(content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="timetable-template.csv"'
        return response

    @action(detail=False, methods=["post"], url_path="preview", parser_classes=[MultiPartParser])
    def preview(self, request):
        """Parse an uploaded CSV/XLSX and return validated rows + warnings.

        This is a dry-run: nothing is persisted. The client renders the
        preview and then calls ``preview-commit`` with the same body to
        actually create the events.
        """
        source_format = (request.data.get("source_format") or "csv").lower()
        import_type = request.data.get("import_type") or "lecture"
        file = request.FILES.get("file")
        if file is None:
            return Response(
                {"success": False, "error": {"detail": "file field is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .services.schedule_parse import parse_schedule

        rows, warnings = parse_schedule(
            source_format, file.read(), filename=file.name or ""
        )
        return Response({"rows": rows, "warnings": warnings, "row_count": len(rows)})

    @action(detail=False, methods=["post"], url_path="preview-commit", parser_classes=[MultiPartParser])
    def preview_commit(self, request):
        """Commit a previously previewed timetable as CalendarEvents.

        Accepts the same multipart body as ``preview`` plus optional
        ``faculty`` / ``department`` links, and materialises the parsed rows
        into events under the tenant. Only tenant admins may re-run this.
        """
        from django.db import transaction

        from apps.academics.models import Faculty, Department
        from .models import CalendarEvent
        from .services.schedule_parse import parse_schedule, rows_to_events

        source_format = (request.data.get("source_format") or "csv").lower()
        import_type = request.data.get("import_type") or "lecture"
        title = (request.data.get("title") or "").strip()[:255]
        file = request.FILES.get("file")
        if file is None:
            return Response(
                {"success": False, "error": {"detail": "file field is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw = file.read()
        rows, warnings = parse_schedule(source_format, raw, filename=file.name or "")
        layer_default = {
            "lecture": CalendarLayer.ACADEMIC,
            "exam": CalendarLayer.EXAMS,
            "events": CalendarLayer.INSTITUTION,
        }.get(import_type, CalendarLayer.ACADEMIC)

        faculty = department = None
        faculty_id = request.data.get("faculty")
        department_id = request.data.get("department")
        if faculty_id:
            try:
                faculty = Faculty.objects.get(id=faculty_id, tenant=request.user.tenant)
            except Faculty.DoesNotExist:
                faculty = None
        if department_id:
            try:
                department = Department.objects.get(id=department_id, tenant=request.user.tenant)
            except Department.DoesNotExist:
                department = None

        events = rows_to_events(
            rows, request.user.tenant, request.user, import_type, layer_default
        )

        with transaction.atomic():
            created_ids = []
            for event in events:
                event.save()
                created_ids.append(str(event.id))

            schedule = CalendarSchedule.objects.create(
                tenant=request.user.tenant,
                import_type=import_type,
                title=title or f"{import_type.title()} timetable",
                file_name=file.name or "",
                source_format=source_format,
                faculty=faculty,
                department=department,
                uploaded_by=request.user,
                event_count=len(created_ids),
                error_count=len(warnings),
                import_log=warnings,
                committed=True,
            )

        return Response({
            "success": True,
            "schedule_id": str(schedule.id),
            "event_count": len(created_ids),
            "error_count": len(warnings),
            "warnings": warnings,
        })

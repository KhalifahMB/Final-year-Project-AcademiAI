from django.core.exceptions import PermissionDenied

import logging

from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.db import tenant_scope
from apps.common.viewsets import AdminWriteViewSet

from .models import (
    Faculty, Department, Programme, AcademicSession, Semester,
    Course, CourseOffering, LecturerCourseAssignment, CourseEnrollment,
    CurriculumCourse,
)
from .serializers import (
    FacultySerializer, DepartmentSerializer, ProgrammeSerializer,
    AcademicSessionSerializer, SemesterSerializer, CourseSerializer,
    CourseOfferingSerializer, LecturerAssignmentSerializer, CourseEnrollmentSerializer,
    CurriculumCourseSerializer,
)

logger = logging.getLogger(__name__)


@extend_schema(tags=["Faculties"])
class FacultyViewSet(AdminWriteViewSet):
    """Read for all tenant members; create/update/delete restricted to Admins."""

    queryset = Faculty.objects.all()
    serializer_class = FacultySerializer
    search_fields = ["name", "code"]
    filterset_fields = ["code"]


@extend_schema(tags=["Departments"])
class DepartmentViewSet(AdminWriteViewSet):
    queryset = Department.objects.select_related("faculty")
    serializer_class = DepartmentSerializer
    search_fields = ["name", "code"]
    filterset_fields = ["faculty"]


@extend_schema(tags=["Programmes"])
class ProgrammeViewSet(AdminWriteViewSet):
    queryset = Programme.objects.select_related("department")
    serializer_class = ProgrammeSerializer
    search_fields = ["name", "code"]
    filterset_fields = ["department"]


@extend_schema(
    tags=["Programmes"],
    summary="Public programme directory for signup",
    description=(
        "Unauthenticated list of programmes for one ACTIVE tenant slug, "
        "used by the signup form so students can pick their programme "
        "(drives auto-enrollment). Exposes id/name/code/department only."
    ),
    auth=[],
)
class ProgrammeDirectoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from apps.academics.models import Programme
        from apps.tenants.models import Tenant

        slug = (request.query_params.get("tenant") or "").strip()
        tenant = Tenant.objects.filter(slug=slug, status=Tenant.Status.ACTIVE).first()
        if not tenant:
            return Response({"count": 0, "results": []})
        # Programmes are RLS-protected; anonymous requests have no tenant
        # context, so open the tenant's scope explicitly.
        with tenant_scope(str(tenant.id)):
            qs = (
                Programme.objects.select_related("department")
                .order_by("name")
            )
            data = [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "code": p.code,
                    "degree_type": p.degree_type,
                    "department_id": str(p.department_id),
                }
                for p in qs.iterator()
            ]
        return Response({"count": len(data), "results": data})


@extend_schema(tags=["Academic Sessions"])
class AcademicSessionViewSet(AdminWriteViewSet):
    queryset = AcademicSession.objects.all()
    serializer_class = AcademicSessionSerializer


@extend_schema(tags=["Semesters"])
class SemesterViewSet(AdminWriteViewSet):
    queryset = Semester.objects.select_related("academic_session").order_by("start_date")
    serializer_class = SemesterSerializer
    filterset_fields = ["academic_session"]

    def perform_update(self, serializer):
        semester = serializer.save()
        # Only one current semester per tenant at a time.
        if semester.is_current:
            Semester.objects.filter(
                tenant_id=semester.tenant_id, is_current=True
            ).exclude(id=semester.id).update(is_current=False)


@extend_schema(tags=["Courses"])
class CourseViewSet(AdminWriteViewSet):
    queryset = Course.objects.select_related("department")
    serializer_class = CourseSerializer
    search_fields = ["code", "title"]
    filterset_fields = ["department", "status"]


@extend_schema(tags=["Course Offerings"])
class CourseOfferingViewSet(AdminWriteViewSet):
    queryset = CourseOffering.objects.select_related(
        "course", "academic_session", "semester"
    ).order_by("-created_at")
    serializer_class = CourseOfferingSerializer
    filterset_fields = ["course", "academic_session", "semester", "status"]

    def perform_create(self, serializer):
        offering = serializer.save()
        try:
            from .services import enroll_department_students

            enroll_department_students(offering)
        except Exception:
            logger.exception(
                "Auto-enrollment failed for new offering=%s", offering.id
            )


@extend_schema(tags=["Lecturer Assignments"])
class LecturerAssignmentViewSet(AdminWriteViewSet):
    queryset = LecturerCourseAssignment.objects.select_related(
        "course_offering__course",
        "course_offering__academic_session",
        "course_offering__semester",
        "lecturer",
    ).order_by("-created_at")
    serializer_class = LecturerAssignmentSerializer
    filterset_fields = ["course_offering", "lecturer"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Lecturers only see their own assignments; admins manage all.
        if user.role == "lecturer":
            qs = qs.filter(lecturer=user)
        return qs


@extend_schema(tags=["Enrollments"])
class CourseEnrollmentViewSet(AdminWriteViewSet):
    queryset = CourseEnrollment.objects.select_related(
        "course_offering__course",
        "course_offering__academic_session",
        "course_offering__semester",
        "student",
    ).order_by("-created_at")
    serializer_class = CourseEnrollmentSerializer
    filterset_fields = ["course_offering", "course_offering__course", "student", "status"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Students only see their own enrollments; admins manage all.
        if user.role == "student":
            qs = qs.filter(student=user)
        return qs


@extend_schema(tags=["Curriculum"])
class CurriculumCourseViewSet(AdminWriteViewSet):
    """
    Programme curriculum entries. CurriculumCourse has no direct tenant FK,
    so scoping is enforced through the parent programme — a naive queryset
    would expose other tenants' curricula.
    """

    serializer_class = CurriculumCourseSerializer
    filterset_fields = ["programme", "course", "level"]

    def get_queryset(self):
        user = self.request.user
        return (
            CurriculumCourse.objects
            .select_related("programme", "course")
            .filter(programme__tenant_id=user.tenant_id)
        )

    def perform_create(self, serializer):
        programme = serializer.validated_data.get("programme")
        course = serializer.validated_data.get("course")
        tenant_id = self.request.user.tenant_id
        if programme is None or programme.tenant_id != tenant_id:
            raise PermissionDenied("Unknown programme.")
        if course is None or course.tenant_id != tenant_id:
            raise PermissionDenied("Unknown course.")
        serializer.save()

    def perform_update(self, serializer):
        # Never allow moving an entry outside the tenant's own structure.
        programme = serializer.validated_data.get("programme") or serializer.instance.programme
        course = serializer.validated_data.get("course") or serializer.instance.course
        tenant_id = self.request.user.tenant_id
        if programme.tenant_id != tenant_id or course.tenant_id != tenant_id:
            raise PermissionDenied("Curriculum entries cannot leave your institution.")
        serializer.save()

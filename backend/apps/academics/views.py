from django.core.exceptions import PermissionDenied

import logging

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

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
        "and build their academic profile. Exposes id/name/code/department only."
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


@extend_schema(tags=["Lecturer Assignments"])
class LecturerAssignmentViewSet(AdminWriteViewSet):
    queryset = LecturerCourseAssignment.objects.select_related(
        "course_offering__course",
        "course_offering__academic_session",
        "course_offering__semester",
        "lecturer",
    ).order_by("-created_at")
    serializer_class = LecturerAssignmentSerializer
    filterset_fields = ["course_offering", "course_offering__course", "lecturer"]

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

    @action(detail=False, methods=["post"])
    def enroll(self, request):
        """Self-service enrolment: a student joins an active offering."""
        user = request.user
        if user.role != "student":
            return Response(
                {"detail": "Only students can enrol themselves."},
                status=status.HTTP_403_FORBIDDEN,
            )
        offering_id = request.data.get("course_offering")
        if not offering_id:
            return Response(
                {"detail": "course_offering is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        offering = (
            CourseOffering.objects.filter(tenant_id=user.tenant_id, id=offering_id)
            .select_related("course", "academic_session", "semester")
            .first()
        )
        if not offering:
            return Response(
                {"detail": "Offering not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if offering.status != "active":
            return Response(
                {"detail": "This offering is not open for enrolment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with tenant_scope(str(user.tenant_id)):
            enrollment, created = CourseEnrollment.objects.get_or_create(
                tenant_id=user.tenant_id,
                course_offering=offering,
                student=user,
                defaults={"status": CourseEnrollment.Status.ENROLLED},
            )
        serializer = self.get_serializer(enrollment)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def unenroll(self, request):
        """Self-service unenrolment: a student leaves an offering."""
        user = request.user
        if user.role != "student":
            return Response(
                {"detail": "Only students can unenrol themselves."},
                status=status.HTTP_403_FORBIDDEN,
            )
        offering_id = request.data.get("course_offering")
        if not offering_id:
            return Response(
                {"detail": "course_offering is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with tenant_scope(str(user.tenant_id)):
            deleted, _ = CourseEnrollment.objects.filter(
                tenant_id=user.tenant_id,
                student=user,
                course_offering_id=offering_id,
            ).delete()
        message = "Unenrolled." if deleted else "You are not enrolled in this offering."
        return Response({"success": True, "message": message})


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

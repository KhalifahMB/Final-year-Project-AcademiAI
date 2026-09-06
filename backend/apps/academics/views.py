from django.core.exceptions import PermissionDenied

import logging

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from apps.common.db import tenant_scope
from apps.common.permissions import IsAdminRoleOrSuperuser
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
    tags=["Faculties"],
    summary="Public faculty directory for signup",
    description=(
        "Unauthenticated list of faculties for one ACTIVE tenant slug, "
        "used by the signup form so students/lecturers scope departments "
        "before choosing a programme. Exposes id/name/code only. "
        "Supports ?search= for large structures."
    ),
    auth=[],
)
class FacultyDirectoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from apps.academics.models import Faculty
        from apps.tenants.models import Tenant

        slug = (request.query_params.get("tenant") or "").strip()
        tenant = Tenant.objects.filter(slug=slug, status=Tenant.Status.ACTIVE).first()
        if not tenant:
            return Response({"count": 0, "results": []})
        # Faculties are RLS-protected; anonymous requests have no tenant
        # context, so open the tenant's scope explicitly.
        search = (request.query_params.get("search") or "").strip()
        with tenant_scope(str(tenant.id)):
            qs = Faculty.objects.order_by("name")
            if search:
                qs = qs.filter(name__icontains=search) | qs.filter(code__icontains=search)
            data = [
                {
                    "id": str(f.id),
                    "name": f.name,
                    "code": f.code,
                }
                for f in qs.order_by("name").iterator()
            ]
        return Response({"count": len(data), "results": data})


@extend_schema(
    tags=["Departments"],
    summary="Public department directory for signup",
    description=(
        "Unauthenticated list of departments for one ACTIVE tenant slug, "
        "used by the signup form so students/lecturers pick their department "
        "before choosing a programme. Exposes id/name/code/faculty only. "
        "Supports ?faculty=<uuid> to scope to one faculty and ?search= "
        "for large structures."
    ),
    auth=[],
)
class DepartmentDirectoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from apps.academics.models import Department
        from apps.tenants.models import Tenant

        slug = (request.query_params.get("tenant") or "").strip()
        tenant = Tenant.objects.filter(slug=slug, status=Tenant.Status.ACTIVE).first()
        if not tenant:
            return Response({"count": 0, "results": []})
        # Departments are RLS-protected; anonymous requests have no tenant
        # context, so open the tenant's scope explicitly.
        faculty_id = (request.query_params.get("faculty") or "").strip()
        search = (request.query_params.get("search") or "").strip()
        with tenant_scope(str(tenant.id)):
            qs = Department.objects.select_related("faculty").order_by("name")
            if faculty_id:
                qs = qs.filter(faculty_id=faculty_id)
            if search:
                qs = qs.filter(name__icontains=search) | qs.filter(code__icontains=search)
            data = [
                {
                    "id": str(d.id),
                    "name": d.name,
                    "code": d.code,
                    "faculty_name": d.faculty.name if d.faculty_id else "",
                }
                for d in qs.order_by("name").iterator()
            ]
        return Response({"count": len(data), "results": data})


@extend_schema(
    tags=["Programmes"],
    summary="Public programme directory for signup",
    description=(
        "Unauthenticated list of programmes for one ACTIVE tenant slug, "
        "used by the signup form so students can pick their programme "
        "and build their academic profile. Exposes id/name/code/department only. "
        "Supports ?department=<uuid> to scope to one department and ?search= "
        "for large catalogues."
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
        department_id = (request.query_params.get("department") or "").strip()
        search = (request.query_params.get("search") or "").strip()
        with tenant_scope(str(tenant.id)):
            qs = (
                Programme.objects.select_related("department")
                .order_by("name")
            )
            if department_id:
                qs = qs.filter(department_id=department_id)
            if search:
                qs = qs.filter(name__icontains=search) | qs.filter(code__icontains=search)
            data = [
                {
                    "id": str(p.id),
                    "name": p.name,
                    "code": p.code,
                    "degree_type": p.degree_type,
                    "department_id": str(p.department_id),
                    "department_name": p.department.name if p.department_id else "",
                }
                for p in qs.iterator()
            ]
        return Response({"count": len(data), "results": data})


@extend_schema(tags=["Academic Sessions"])
class AcademicSessionViewSet(AdminWriteViewSet):
    queryset = AcademicSession.objects.all()
    serializer_class = AcademicSessionSerializer

    def perform_create(self, serializer):
        super().perform_create(serializer)
        instance = serializer.instance
        # Auto-set as current if it is the latest by start_date.
        is_latest = not AcademicSession.objects.filter(
            tenant_id=instance.tenant_id,
            start_date__gt=instance.start_date,
        ).exists()
        if is_latest:
            instance.is_current = True
            instance.save(update_fields=["is_current"])


@extend_schema(tags=["Semesters"])
class SemesterViewSet(AdminWriteViewSet):
    queryset = Semester.objects.select_related("academic_session").order_by("start_date")
    serializer_class = SemesterSerializer
    filterset_fields = ["academic_session"]

    def perform_create(self, serializer):
        super().perform_create(serializer)
        instance = serializer.instance
        # Auto-set as current if it is the latest by start_date.
        is_latest = not Semester.objects.filter(
            tenant_id=instance.tenant_id,
            start_date__gt=instance.start_date,
        ).exists()
        if is_latest:
            instance.is_current = True
            instance.save(update_fields=["is_current"])


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
    ).prefetch_related("lecturer_assignments__lecturer").order_by("-created_at")
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
    """
    Management surface for enrollments (tenant admins): list all enrollments
    in the tenant, create/update/delete them. Students must use the dedicated
    self-service endpoints: GET /course-enrollments/mine/, POST /enroll/, POST /unenroll/.
    """

    queryset = CourseEnrollment.objects.select_related(
        "course_offering__course",
        "course_offering__academic_session",
        "course_offering__semester",
        "student",
    ).order_by("-created_at")
    serializer_class = CourseEnrollmentSerializer
    filterset_fields = ["course_offering", "course_offering__course", "student", "status"]

    def get_permissions(self):
        # The list/retrieve + CRUD endpoints are an admin management surface.
        if self.action in ("list", "retrieve", "create", "update", "partial_update", "destroy"):
            return [IsAdminRoleOrSuperuser()]
        # Self-service actions (mine, enroll, unenroll): any tenant member.
        return super().get_permissions()

    @action(detail=False, methods=["get"])
    def mine(self, request):
        """The caller's own enrollments. Empty for non-students.

        Used by "My Courses" so an admin/lecturer never sees the whole
        tenant's enrollments through a personal view.
        """
        enrollments = self.filter_queryset(self.get_queryset().filter(student=request.user))
        page = self.paginate_queryset(enrollments)
        serializer = self.get_serializer(
            page if page is not None else enrollments, many=True
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

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

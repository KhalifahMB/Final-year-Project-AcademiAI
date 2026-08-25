from drf_spectacular.utils import extend_schema

from apps.common.viewsets import AdminWriteViewSet
from .models import (
    Faculty, Department, Programme, AcademicSession, Semester,
    Course, CourseOffering, LecturerCourseAssignment, CourseEnrollment,
)
from .serializers import (
    FacultySerializer, DepartmentSerializer, ProgrammeSerializer,
    AcademicSessionSerializer, SemesterSerializer, CourseSerializer,
    CourseOfferingSerializer, LecturerAssignmentSerializer, CourseEnrollmentSerializer,
)


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


@extend_schema(tags=["Academic Sessions"])
class AcademicSessionViewSet(AdminWriteViewSet):
    queryset = AcademicSession.objects.all()
    serializer_class = AcademicSessionSerializer


@extend_schema(tags=["Semesters"])
class SemesterViewSet(AdminWriteViewSet):
    queryset = Semester.objects.select_related("academic_session")
    serializer_class = SemesterSerializer
    filterset_fields = ["academic_session"]


@extend_schema(tags=["Courses"])
class CourseViewSet(AdminWriteViewSet):
    queryset = Course.objects.select_related("department")
    serializer_class = CourseSerializer
    search_fields = ["code", "title"]
    filterset_fields = ["department", "status"]


@extend_schema(tags=["Course Offerings"])
class CourseOfferingViewSet(AdminWriteViewSet):
    queryset = CourseOffering.objects.select_related("course", "academic_session", "semester")
    serializer_class = CourseOfferingSerializer
    filterset_fields = ["course", "academic_session", "semester", "status"]


@extend_schema(tags=["Lecturer Assignments"])
class LecturerAssignmentViewSet(AdminWriteViewSet):
    queryset = LecturerCourseAssignment.objects.select_related("course_offering", "lecturer")
    serializer_class = LecturerAssignmentSerializer
    filterset_fields = ["course_offering", "lecturer"]


@extend_schema(tags=["Enrollments"])
class CourseEnrollmentViewSet(AdminWriteViewSet):
    queryset = CourseEnrollment.objects.select_related("course_offering", "student")
    serializer_class = CourseEnrollmentSerializer
    filterset_fields = ["course_offering", "student", "status"]

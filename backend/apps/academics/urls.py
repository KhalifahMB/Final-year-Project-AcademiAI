from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    FacultyViewSet, DepartmentViewSet, ProgrammeViewSet,
    ProgrammeDirectoryView,
    AcademicSessionViewSet, SemesterViewSet, CourseViewSet,
    CourseOfferingViewSet, LecturerAssignmentViewSet, CourseEnrollmentViewSet,
    CurriculumCourseViewSet,
)

router = DefaultRouter()
router.register("faculties", FacultyViewSet, basename="faculty")
router.register("departments", DepartmentViewSet, basename="department")
router.register("programmes", ProgrammeViewSet, basename="programme")
router.register("academic-sessions", AcademicSessionViewSet, basename="academic-session")
router.register("semesters", SemesterViewSet, basename="semester")
router.register("courses", CourseViewSet, basename="course")
router.register("course-offerings", CourseOfferingViewSet, basename="course-offering")
router.register("lecturer-assignments", LecturerAssignmentViewSet, basename="lecturer-assignment")
router.register("course-enrollments", CourseEnrollmentViewSet, basename="course-enrollment")
router.register("curriculum", CurriculumCourseViewSet, basename="curriculum")

urlpatterns = [
    # Before the router so "programme-directory" is not parsed as a pk.
    path(
        "programme-directory/",
        ProgrammeDirectoryView.as_view(),
        name="programme-directory",
    ),
] + router.urls

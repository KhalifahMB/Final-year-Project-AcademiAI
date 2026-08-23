from django.contrib import admin
from .models import (
    Faculty, Department, Programme, AcademicSession, Semester,
    Course, CurriculumCourse, CourseOffering,
    CourseEnrollment, LecturerCourseAssignment,
)

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "tenant")
    search_fields = ("name", "code")

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "faculty", "tenant")
    search_fields = ("name", "code")

@admin.register(Programme)
class ProgrammeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "department", "tenant")
    search_fields = ("name", "code")

@admin.register(AcademicSession)
class AcademicSessionAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "is_current", "tenant")

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ("name", "academic_session", "start_date", "end_date", "tenant")

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "department", "tenant")
    search_fields = ("code", "title")

@admin.register(CurriculumCourse)
class CurriculumCourseAdmin(admin.ModelAdmin):
    list_display = ("programme", "course", "level", "is_core")

@admin.register(CourseOffering)
class CourseOfferingAdmin(admin.ModelAdmin):
    list_display = ("course", "academic_session", "semester", "tenant")
    list_filter = ("academic_session",)

@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "course_offering", "status", "tenant")
    list_filter = ("status",)

@admin.register(LecturerCourseAssignment)
class LecturerCourseAssignmentAdmin(admin.ModelAdmin):
    list_display = ("lecturer", "course_offering", "tenant")

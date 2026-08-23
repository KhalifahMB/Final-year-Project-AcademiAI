from django.contrib import admin
from .models import (
    Faculty, Department, Programme, Course, CourseOffering,
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

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "programme", "tenant")
    search_fields = ("code", "title")

@admin.register(CourseOffering)
class CourseOfferingAdmin(admin.ModelAdmin):
    list_display = ("course", "academic_year", "semester", "tenant")
    list_filter = ("academic_year", "semester")

@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "course_offering", "status", "tenant")
    list_filter = ("status",)

@admin.register(LecturerCourseAssignment)
class LecturerCourseAssignmentAdmin(admin.ModelAdmin):
    list_display = ("lecturer", "course_offering", "tenant")

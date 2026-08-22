from rest_framework import serializers
from .models import (
    Faculty, Department, Programme, AcademicSession, Semester,
    Course, CourseOffering, LecturerCourseAssignment, CourseEnrollment,
)


class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty
        fields = ("id", "name", "code", "tenant", "created_at", "updated_at")
        read_only_fields = ("id", "tenant", "created_at", "updated_at")


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "faculty", "name", "code", "tenant", "created_at", "updated_at")
        read_only_fields = ("id", "tenant", "created_at", "updated_at")


class ProgrammeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programme
        fields = (
            "id", "department", "name", "code", "degree_type", "duration_years",
            "tenant", "created_at", "updated_at",
        )
        read_only_fields = ("id", "tenant", "created_at", "updated_at")


class AcademicSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicSession
        fields = ("id", "name", "start_date", "end_date", "is_current", "tenant", "created_at")
        read_only_fields = ("id", "tenant", "created_at")


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = (
            "id", "academic_session", "name", "start_date", "end_date",
            "tenant", "created_at",
        )
        read_only_fields = ("id", "tenant", "created_at")


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = (
            "id", "department", "code", "title", "description", "credit_unit",
            "status", "tenant", "created_at", "updated_at",
        )
        read_only_fields = ("id", "tenant", "created_at", "updated_at")


class CourseOfferingSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = CourseOffering
        fields = (
            "id", "course", "course_code", "course_title", "academic_session",
            "semester", "status", "tenant", "created_at",
        )
        read_only_fields = ("id", "tenant", "created_at")


class LecturerAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LecturerCourseAssignment
        fields = (
            "id", "course_offering", "lecturer", "assignment_role",
            "tenant", "created_at",
        )
        read_only_fields = ("id", "tenant", "created_at")


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseEnrollment
        fields = (
            "id", "course_offering", "student", "status", "enrolled_at",
            "tenant", "created_at",
        )
        read_only_fields = ("id", "tenant", "enrolled_at", "created_at")

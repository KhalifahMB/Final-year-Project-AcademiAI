from rest_framework import serializers
from .models import (
    Faculty, Department, Programme, AcademicSession, Semester,
    Course, CourseOffering, LecturerCourseAssignment, CourseEnrollment,
    CurriculumCourse,
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
    session_name = serializers.CharField(
        source="academic_session.name", read_only=True
    )

    class Meta:
        model = Semester
        fields = (
            "id", "academic_session", "session_name", "name", "start_date",
            "end_date", "is_current",
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
    session_name = serializers.CharField(
        source="academic_session.name", read_only=True
    )
    semester_name = serializers.CharField(source="semester.name", read_only=True)

    class Meta:
        model = CourseOffering
        fields = (
            "id", "course", "course_code", "course_title",
            "academic_session", "session_name", "semester", "semester_name",
            "status", "tenant", "created_at",
        )
        read_only_fields = ("id", "tenant", "created_at")


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    # Display fields so clients never have to render raw offering UUIDs.
    offering_course_code = serializers.CharField(
        source="course_offering.course.code", read_only=True
    )
    offering_course_title = serializers.CharField(
        source="course_offering.course.title", read_only=True
    )
    session_name = serializers.CharField(
        source="course_offering.academic_session.name", read_only=True
    )
    semester_name = serializers.CharField(
        source="course_offering.semester.name", read_only=True
    )

    class Meta:
        model = CourseEnrollment
        fields = (
            "id", "course_offering",
            "offering_course_code", "offering_course_title",
            "session_name", "semester_name",
            "student", "student_email", "student_name",
            "status", "enrolled_at",
            "tenant", "created_at",
        )
        read_only_fields = ("id", "tenant", "enrolled_at", "created_at")

    def validate(self, attrs):
        request = self.context.get("request")
        tenant_id = getattr(getattr(request, "user", None), "tenant_id", None)
        if tenant_id is None:
            return attrs
        offering = attrs.get("course_offering")
        if offering is not None and offering.tenant_id != tenant_id:
            raise serializers.ValidationError({"course_offering": "Unknown offering."})
        student = attrs.get("student")
        if student is not None:
            if student.tenant_id != tenant_id:
                raise serializers.ValidationError({"student": "Unknown student."})
            if student.role != "student":
                raise serializers.ValidationError({"student": "Only students can be enrolled."})
        return attrs


class LecturerAssignmentSerializer(serializers.ModelSerializer):
    lecturer_email = serializers.EmailField(source="lecturer.email", read_only=True)
    lecturer_name = serializers.CharField(source="lecturer.full_name", read_only=True)
    offering_course_code = serializers.CharField(
        source="course_offering.course.code", read_only=True
    )
    offering_course_title = serializers.CharField(
        source="course_offering.course.title", read_only=True
    )
    session_name = serializers.CharField(
        source="course_offering.academic_session.name", read_only=True
    )
    semester_name = serializers.CharField(
        source="course_offering.semester.name", read_only=True
    )

    class Meta:
        model = LecturerCourseAssignment
        fields = (
            "id", "course_offering",
            "offering_course_code", "offering_course_title",
            "session_name", "semester_name",
            "lecturer", "lecturer_email", "lecturer_name",
            "assignment_role",
            "tenant", "created_at",
        )
        read_only_fields = ("id", "tenant", "created_at")

    def validate(self, attrs):
        request = self.context.get("request")
        tenant_id = getattr(getattr(request, "user", None), "tenant_id", None)
        if tenant_id is None:
            return attrs
        offering = attrs.get("course_offering")
        if offering is not None and offering.tenant_id != tenant_id:
            raise serializers.ValidationError({"course_offering": "Unknown offering."})
        lecturer = attrs.get("lecturer")
        if lecturer is not None:
            if lecturer.tenant_id != tenant_id:
                raise serializers.ValidationError({"lecturer": "Unknown lecturer."})
            if lecturer.role != "lecturer":
                raise serializers.ValidationError(
                    {"lecturer": "Only lecturers can be assigned to courses."}
                )
        return attrs


class CurriculumCourseSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = CurriculumCourse
        fields = (
            "id", "programme", "course", "course_code", "course_title",
            "level", "semester", "is_core",
        )
        read_only_fields = ("id",)

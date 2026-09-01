"""
Academic hierarchy: Faculty → Department → Programme → Course → Course Offering
+ sessions, semesters, assignments, enrollments.
"""
from django.db import models

from apps.common.models import TenantScopedModel


class Faculty(TenantScopedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)

    class Meta:
        db_table = "faculties"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="uniq_faculty_code_per_tenant")
        ]
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Department(TenantScopedModel):
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)

    class Meta:
        db_table = "departments"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="uniq_dept_code_per_tenant")
        ]
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Programme(TenantScopedModel):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="programmes")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    degree_type = models.CharField(max_length=50, blank=True)  # BSc, MSc, PhD...
    duration_years = models.PositiveSmallIntegerField(default=4)

    class Meta:
        db_table = "programmes"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="uniq_programme_code_per_tenant")
        ]
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class AcademicSession(TenantScopedModel):
    name = models.CharField(max_length=100)  # e.g. 2025/2026
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = "academic_sessions"
        ordering = ["-start_date"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_current:
            AcademicSession.objects.filter(
                tenant_id=self.tenant_id, is_current=True
            ).exclude(id=self.id).update(is_current=False)


class Semester(TenantScopedModel):
    academic_session = models.ForeignKey(
        AcademicSession, on_delete=models.CASCADE, related_name="semesters"
    )
    name = models.CharField(max_length=50)  # First Semester, Second Semester
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        db_table = "semesters"
        constraints = [
            models.UniqueConstraint(
                fields=["academic_session", "name"], name="uniq_semester_per_session"
            )
        ]
        ordering = ["start_date"]

    def __str__(self):
        return f"{self.academic_session.name} — {self.name}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_current:
            Semester.objects.filter(
                tenant_id=self.tenant_id, is_current=True
            ).exclude(id=self.id).update(is_current=False)


class Course(TenantScopedModel):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="courses")
    code = models.CharField(max_length=50)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    credit_unit = models.PositiveSmallIntegerField(default=3)
    status = models.CharField(max_length=20, default="active")

    class Meta:
        db_table = "courses"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="uniq_course_code_per_tenant")
        ]
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.title}"


class CurriculumCourse(models.Model):
    """Links a course into a programme curriculum."""
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name="curriculum")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="curricula")
    level = models.PositiveSmallIntegerField()
    semester = models.CharField(max_length=20, blank=True)
    is_core = models.BooleanField(default=True)

    class Meta:
        db_table = "curriculum_courses"
        constraints = [
            models.UniqueConstraint(
                fields=["programme", "course"], name="uniq_curriculum_programme_course"
            )
        ]


class CourseOffering(TenantScopedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="offerings")
    academic_session = models.ForeignKey(
        AcademicSession, on_delete=models.CASCADE, related_name="offerings"
    )
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name="offerings")
    status = models.CharField(max_length=20, default="active")

    class Meta:
        db_table = "course_offerings"
        constraints = [
            models.UniqueConstraint(
                fields=["course", "academic_session", "semester"],
                name="uniq_offering_course_session_semester",
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "status"]),
        ]

    def __str__(self):
        return f"{self.course.code} ({self.academic_session.name} / {self.semester.name})"


class LecturerCourseAssignment(TenantScopedModel):
    course_offering = models.ForeignKey(
        CourseOffering, on_delete=models.CASCADE, related_name="lecturer_assignments"
    )
    lecturer = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="course_assignments"
    )
    assignment_role = models.CharField(max_length=50, default="lecturer")  # lecturer, coordinator

    class Meta:
        db_table = "lecturer_course_assignments"
        constraints = [
            models.UniqueConstraint(
                fields=["course_offering", "lecturer"],
                name="uniq_lecturer_per_offering",
            )
        ]


class CourseEnrollment(TenantScopedModel):
    class Status(models.TextChoices):
        ENROLLED = "enrolled", "Enrolled"
        COMPLETED = "completed", "Completed"
        DROPPED = "dropped", "Dropped"

    course_offering = models.ForeignKey(
        CourseOffering, on_delete=models.CASCADE, related_name="enrollments"
    )
    student = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="enrollments"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ENROLLED)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "course_enrollments"
        constraints = [
            models.UniqueConstraint(
                fields=["course_offering", "student"],
                name="uniq_enrollment_student_offering",
            )
        ]
        indexes = [
            models.Index(fields=["student", "course_offering"]),
        ]

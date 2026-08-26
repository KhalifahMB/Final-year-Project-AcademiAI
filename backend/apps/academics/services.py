"""
Academics domain services.
"""
import logging

logger = logging.getLogger(__name__)


def auto_enroll_student(user) -> int:
    """
    Enrol a verified student into every active course offering whose course
    belongs to their programme's department. Runs at first email
    verification; safe to call repeatedly (idempotent via get_or_create).
    Returns the number of enrolments created.
    """
    from apps.accounts.models import StudentProfile
    from apps.academics.models import CourseEnrollment, CourseOffering
    from apps.common.db import tenant_scope
    from django.db import transaction

    if user.role != "student" or user.tenant_id is None:
        return 0

    # Verification requests are anonymous → no RLS context from middleware;
    # open the student's tenant scope explicitly.
    with tenant_scope(str(user.tenant_id)), transaction.atomic():
        profile = (
            StudentProfile.objects.filter(user=user)
            .select_related("programme__department")
            .first()
        )
        if not profile or profile.programme_id is None:
            return 0

        department = profile.programme.department
        offerings = CourseOffering.objects.filter(
            status="active",
            course__department_id=department.id,
        )
        created = 0
        for offering in offerings:
            _, was_created = CourseEnrollment.objects.get_or_create(
                tenant_id=user.tenant_id,
                course_offering=offering,
                student=user,
                defaults={"status": CourseEnrollment.Status.ENROLLED},
            )
            created += 1 if was_created else 0
    if created:
        logger.info(
            "Auto-enrolled student=%s into %s offering(s) dept=%s",
            user.id, created, department.id,
        )
    return created


def enroll_department_students(offering) -> int:
    """
    Enrol every verified student whose programme belongs to the offering's
    course department into a newly created course offering. Called when an
    admin adds an offering so students are enrolled automatically (mirrors
    auto_enroll_student, which covers students who verify *after* the
    offering exists). Idempotent via get_or_create.
    Returns the number of enrolments created.
    """
    from apps.accounts.models import StudentProfile
    from apps.academics.models import CourseEnrollment

    tenant_id = offering.tenant_id
    students = (
        StudentProfile.objects.filter(
            tenant_id=tenant_id,
            programme__department_id=offering.course.department_id,
            user__role="student",
            user__is_active=True,
            user__is_email_verified=True,
        )
        .exclude(programme_id=None)
        .values_list("user_id", flat=True)
    )
    created = 0
    for student_id in students:
        _, was_created = CourseEnrollment.objects.get_or_create(
            tenant_id=tenant_id,
            course_offering=offering,
            student_id=student_id,
            defaults={"status": CourseEnrollment.Status.ENROLLED},
        )
        created += 1 if was_created else 0
    if created:
        logger.info(
            "Auto-enrolled %s student(s) into new offering=%s",
            created, offering.id,
        )
    return created

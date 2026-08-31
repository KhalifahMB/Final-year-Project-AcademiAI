"""
Student self-service enrolment/unenrolment + admin course management tests.

Covers:
  - opt-in enrolment (the opposite of auto-enrolment)
  - tenant/role validation on enrollments and lecturer assignments
  - admin: create a course, create an offering, assign a lecturer
  - no auto-enrolment on email verification or offering creation
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts import services
from apps.accounts.models import User
from apps.academics.models import (
    AcademicSession,
    Course,
    CourseEnrollment,
    CourseOffering,
    Department,
    Faculty,
    LecturerCourseAssignment,
    Programme,
    Semester,
)
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _tenant(slug):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def _user(email, tenant, role):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        is_active=True,
        is_email_verified=True,
    )


def _structure(tenant):
    fac = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
    dept = Department.objects.create(tenant=tenant, faculty=fac, name="CS", code="CS")
    prog = Programme.objects.create(tenant=tenant, department=dept, name="BSc CS", code="BSC-CS")
    session = AcademicSession.objects.create(
        tenant=tenant, name="2025/2026", is_current=True,
        start_date="2025-09-01", end_date="2026-08-31",
    )
    semester = Semester.objects.create(
        tenant=tenant, academic_session=session, name="First", is_current=True,
        start_date="2025-09-01", end_date="2026-01-31",
    )
    return fac, dept, prog, session, semester


def _course_and_offering(tenant, dept, session, semester, code="CS101", status="active"):
    course = Course.objects.create(
        tenant=tenant, department=dept, code=code, title=f"Course {code}"
    )
    offering = CourseOffering.objects.create(
        tenant=tenant, course=course, academic_session=session, semester=semester, status=status
    )
    return course, offering


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_student_can_self_enroll_and_unenroll():
    tenant = _tenant("enroll-u")
    fac, dept, prog, session, semester = _structure(tenant)
    _, offering = _course_and_offering(tenant, dept, session, semester)
    student = _user("stu@enroll-u.edu", tenant, "student")
    client = _auth(student)

    resp = client.post(
        "/api/v1/course-enrollments/enroll/",
        {"course_offering": str(offering.id)},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    enrollment = CourseEnrollment.objects.get(course_offering=offering, student=student)
    assert enrollment.status == CourseEnrollment.Status.ENROLLED

    # Enrolling again is idempotent — no duplicate row.
    resp = client.post(
        "/api/v1/course-enrollments/enroll/",
        {"course_offering": str(offering.id)},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert CourseEnrollment.objects.filter(course_offering=offering, student=student).count() == 1

    resp = client.post(
        "/api/v1/course-enrollments/unenroll/",
        {"course_offering": str(offering.id)},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert not CourseEnrollment.objects.filter(course_offering=offering, student=student).exists()

    # Unenrolling twice is safe.
    resp = client.post(
        "/api/v1/course-enrollments/unenroll/",
        {"course_offering": str(offering.id)},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_student_cannot_enroll_in_inactive_offering():
    tenant = _tenant("inactive-u")
    fac, dept, prog, session, semester = _structure(tenant)
    _, offering = _course_and_offering(tenant, dept, session, semester, status="finished")
    student = _user("stu@inactive-u.edu", tenant, "student")
    client = _auth(student)

    resp = client.post(
        "/api/v1/course-enrollments/enroll/",
        {"course_offering": str(offering.id)},
        format="json",
    )
    assert resp.status_code == 400, resp.data
    assert not CourseEnrollment.objects.filter(course_offering=offering).exists()


@pytest.mark.django_db
def test_student_cannot_enroll_cross_tenant_offering():
    tenant_a = _tenant("cross-a")
    tenant_b = _tenant("cross-b")
    fac_b, dept_b, prog_b, session_b, semester_b = _structure(tenant_b)
    course_b, offering_b = _course_and_offering(tenant_b, dept_b, session_b, semester_b)
    student_a = _user("stu@cross-a.edu", tenant_a, "student")
    client = _auth(student_a)

    resp = client.post(
        "/api/v1/course-enrollments/enroll/",
        {"course_offering": str(offering_b.id)},
        format="json",
    )
    assert resp.status_code == 404, resp.data
    assert CourseEnrollment.objects.filter(course_offering=offering_b).count() == 0


@pytest.mark.django_db
def test_non_student_cannot_self_enroll():
    tenant = _tenant("role-u")
    fac, dept, prog, session, semester = _structure(tenant)
    _, offering = _course_and_offering(tenant, dept, session, semester)
    lecturer = _user("lect@role-u.edu", tenant, "lecturer")
    client = _auth(lecturer)

    resp = client.post(
        "/api/v1/course-enrollments/enroll/",
        {"course_offering": str(offering.id)},
        format="json",
    )
    assert resp.status_code == 403, resp.data
    resp = client.post(
        "/api/v1/course-enrollments/unenroll/",
        {"course_offering": str(offering.id)},
        format="json",
    )
    assert resp.status_code == 403, resp.data


@pytest.mark.django_db
def test_email_verification_no_longer_auto_enrolls():
    """Enrolment is opt-in: verifying a student with a programme and active
    departmental offerings must NOT create any enrollments."""
    tenant = _tenant("verify-u")
    fac, dept, prog, session, semester = _structure(tenant)
    _course_and_offering(tenant, dept, session, semester, code="CS200")
    client = APIClient()

    resp = client.post(
        "/api/v1/auth/signup/",
        {
            "email": "stu@verify-u.edu",
            "password": PASSWORD,
            "first_name": "Veri",
            "role": "student",
            "tenant_slug": "verify-u",
            "programme": str(prog.id),
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    user = User.objects.get(email="stu@verify-u.edu")

    code = services.create_verification_code(user)
    resp = client.post(
        "/api/v1/auth/verify-email/",
        {"email": "stu@verify-u.edu", "code": code},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert CourseEnrollment.objects.filter(tenant=tenant).count() == 0


@pytest.mark.django_db
def test_creating_offering_does_not_auto_enroll():
    tenant = _tenant("offering-u")
    fac, dept, prog, session, semester = _structure(tenant)
    student = _user("stu@offering-u.edu", tenant, "student")
    admin = _user("admin@offering-u.edu", tenant, "tenant_admin")
    course = Course.objects.create(tenant=tenant, department=dept, code="MTH101", title="Maths 1")
    client = _auth(admin)

    resp = client.post(
        "/api/v1/course-offerings/",
        {
            "course": str(course.id),
            "academic_session": str(session.id),
            "semester": str(semester.id),
            "status": "active",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert CourseEnrollment.objects.filter(student=student).count() == 0


@pytest.mark.django_db
def test_admin_creates_course_offering_and_assigns_lecturer():
    tenant = _tenant("mgmt-u")
    fac, dept, prog, session, semester = _structure(tenant)
    admin = _user("admin@mgmt-u.edu", tenant, "tenant_admin")
    lecturer = _user("teach@mgmt-u.edu", tenant, "lecturer")
    client = _auth(admin)

    resp = client.post(
        "/api/v1/courses/",
        {
            "department": str(dept.id),
            "code": "PHY101",
            "title": "Physics 1",
            "credit_unit": 3,
            "description": "Introductory physics",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    course = Course.objects.get(id=resp.data["id"])

    resp = client.post(
        "/api/v1/course-offerings/",
        {
            "course": str(course.id),
            "academic_session": str(session.id),
            "semester": str(semester.id),
            "status": "active",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    offering = CourseOffering.objects.get(id=resp.data["id"])

    resp = client.post(
        "/api/v1/lecturer-assignments/",
        {
            "course_offering": str(offering.id),
            "lecturer": str(lecturer.id),
            "assignment_role": "lecturer",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assignment = LecturerCourseAssignment.objects.get(
        course_offering=offering, lecturer=lecturer
    )
    assert assignment.tenant_id == tenant.id

    # Course-scoped filter drives the manage page listing.
    resp = client.get(
        f"/api/v1/lecturer-assignments/?course_offering__course={course.id}"
    )
    assert resp.status_code == 200
    assert len(resp.data["results"]) == 1
    assert resp.data["results"][0]["lecturer_email"] == lecturer.email


@pytest.mark.django_db
def test_admin_cannot_assign_cross_tenant_lecturer():
    tenant_a = _tenant("assign-a")
    tenant_b = _tenant("assign-b")
    fac, dept, prog, session, semester = _structure(tenant_a)
    _, offering = _course_and_offering(tenant_a, dept, session, semester)
    admin = _user("admin@assign-a.edu", tenant_a, "tenant_admin")
    lecturer_b = _user("lect@assign-b.edu", tenant_b, "lecturer")
    client = _auth(admin)

    resp = client.post(
        "/api/v1/lecturer-assignments/",
        {
            "course_offering": str(offering.id),
            "lecturer": str(lecturer_b.id),
        },
        format="json",
    )
    assert resp.status_code == 400, resp.data
    assert LecturerCourseAssignment.objects.count() == 0


@pytest.mark.django_db
def test_admin_cannot_assign_non_lecturer():
    tenant = _tenant("nolec-u")
    fac, dept, prog, session, semester = _structure(tenant)
    _, offering = _course_and_offering(tenant, dept, session, semester)
    admin = _user("admin@nolec-u.edu", tenant, "tenant_admin")
    student = _user("stu@nolec-u.edu", tenant, "student")
    client = _auth(admin)

    resp = client.post(
        "/api/v1/lecturer-assignments/",
        {
            "course_offering": str(offering.id),
            "lecturer": str(student.id),
        },
        format="json",
    )
    assert resp.status_code == 400, resp.data
    assert LecturerCourseAssignment.objects.count() == 0


@pytest.mark.django_db
def test_admin_cannot_enroll_cross_tenant_student():
    tenant_a = _tenant("enroll-a")
    tenant_b = _tenant("enroll-b")
    fac, dept, prog, session, semester = _structure(tenant_a)
    _, offering = _course_and_offering(tenant_a, dept, session, semester)
    admin = _user("admin@enroll-a.edu", tenant_a, "tenant_admin")
    student_b = _user("stu@enroll-b.edu", tenant_b, "student")
    client = _auth(admin)

    resp = client.post(
        "/api/v1/course-enrollments/",
        {
            "course_offering": str(offering.id),
            "student": str(student_b.id),
        },
        format="json",
    )
    assert resp.status_code == 400, resp.data
    assert CourseEnrollment.objects.count() == 0


@pytest.mark.django_db
def test_mine_endpoint_returns_only_callers_enrollments():
    """GET /course-enrollments/mine/ is scoped to the caller, regardless of role."""
    tenant = _tenant("mine-u")
    fac, dept, prog, session, semester = _structure(tenant)
    _, offering = _course_and_offering(tenant, dept, session, semester)
    admin = _user("admin@mine-u.edu", tenant, "tenant_admin")
    student_a = _user("stu-a@mine-u.edu", tenant, "student")
    student_b = _user("stu-b@mine-u.edu", tenant, "student")

    client = _auth(admin)
    # Admin wires up two enrollments from the management endpoint.
    for s in (student_a, student_b):
        resp = client.post(
            "/api/v1/course-enrollments/",
            {"course_offering": str(offering.id), "student": str(s.id)},
            format="json",
        )
        assert resp.status_code == 201, resp.data

    # Admin "My Courses" must NOT show the whole tenant's enrollments.
    resp = client.get("/api/v1/course-enrollments/mine/")
    assert resp.status_code == 200
    assert resp.data["results"] == []

    # Student A sees only their own enrollment, not Student B's.
    client_a = _auth(student_a)
    resp = client_a.get("/api/v1/course-enrollments/mine/")
    assert resp.status_code == 200
    rows = resp.data["results"]
    assert len(rows) == 1
    assert rows[0]["student_email"] == student_a.email

    # The management list still exposes all enrollments to the admin.
    resp = client.get("/api/v1/course-enrollments/")
    assert resp.status_code == 200
    assert resp.data["count"] == 2


@pytest.mark.django_db
def test_student_cannot_read_management_list():
    """Students must not hit the admin management list; use /mine/ instead."""
    tenant = _tenant("stu-list-u")
    fac, dept, prog, session, semester = _structure(tenant)
    _, offering = _course_and_offering(tenant, dept, session, semester)
    admin = _user("admin@stu-list-u.edu", tenant, "tenant_admin")
    student = _user("stu@stu-list-u.edu", tenant, "student")

    client = _auth(admin)
    resp = client.post(
        "/api/v1/course-enrollments/",
        {"course_offering": str(offering.id), "student": str(student.id)},
        format="json",
    )
    assert resp.status_code == 201, resp.data

    student_client = _auth(student)
    resp = student_client.get("/api/v1/course-enrollments/")
    assert resp.status_code == 403, resp.data
    # ... but they can read their own via the dedicated endpoint.
    resp = student_client.get("/api/v1/course-enrollments/mine/")
    assert resp.status_code == 200
    assert resp.data["count"] == 1
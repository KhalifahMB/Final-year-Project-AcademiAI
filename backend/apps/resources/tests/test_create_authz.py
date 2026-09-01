"""
Course-linked resource creation authorization.

A resource may reference a course offering only if the caller is legitimately
attached to it: students (enrolled, and only with 'course' visibility),
lecturers (assigned to teach it), or admins. The owning department of a
department-scoped course material is always coerced from the offering's course.
"""
import pytest
from rest_framework.test import APIClient

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
from apps.resources.models import Resource
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


def _structure(tenant, code="CS101"):
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
    course = Course.objects.create(tenant=tenant, department=dept, code=code, title=f"Course {code}")
    offering = CourseOffering.objects.create(
        tenant=tenant, course=course, academic_session=session, semester=semester, status="active"
    )
    return dept, course, offering


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _upload(client, offering, scope=Resource.Visibility.COURSE, title="Notes"):
    return client.post(
        "/api/v1/resources/",
        {
            "title": title,
            "description": "",
            "visibility_scope": scope,
            "course_offering": str(offering.id),
        },
        format="json",
    )


@pytest.mark.django_db
def test_student_cannot_attach_offering_with_department_scope():
    tenant = _tenant("stdep-u")
    dept, course, offering = _structure(tenant)
    student = _user("stu@stdep-u.edu", tenant, "student")
    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
        status=CourseEnrollment.Status.ENROLLED,
    )
    resp = _upload(_auth(student), offering, scope=Resource.Visibility.DEPARTMENT)
    assert resp.status_code == 400, resp.data
    assert Resource.objects.count() == 0


@pytest.mark.django_db
def test_unenrolled_student_cannot_attach_course_scope():
    tenant = _tenant("uno-u")
    dept, course, offering = _structure(tenant)
    student = _user("stu@uno-u.edu", tenant, "student")
    resp = _upload(_auth(student), offering, scope=Resource.Visibility.COURSE)
    assert resp.status_code == 400, resp.data
    msg = resp.data.get("error", {}).get("detail", {}).get("course_offering")
    assert msg and "not enrolled" in str(msg)


@pytest.mark.django_db
def test_enrolled_student_can_attach_course_scope():
    tenant = _tenant("enk-u")
    dept, course, offering = _structure(tenant)
    student = _user("stu@enk-u.edu", tenant, "student")
    CourseEnrollment.objects.create(
        tenant=tenant, course_offering=offering, student=student,
        status=CourseEnrollment.Status.ENROLLED,
    )
    resp = _upload(_auth(student), offering, scope=Resource.Visibility.COURSE)
    assert resp.status_code == 201, resp.data
    assert Resource.objects.get().course_offering_id == offering.id


@pytest.mark.django_db
def test_lecturer_not_assigned_cannot_attach():
    tenant = _tenant("noon-u")
    dept, course, offering = _structure(tenant)
    lecturer = _user("l@noon-u.edu", tenant, "lecturer")
    resp = _upload(_auth(lecturer), offering, scope=Resource.Visibility.COURSE)
    assert resp.status_code == 400, resp.data
    assert Resource.objects.count() == 0


@pytest.mark.django_db
def test_assigned_lecturer_department_scope_coerces_department():
    tenant = _tenant("ldep-u")
    dept, course, offering = _structure(tenant)
    lecturer = _user("l@ldep-u.edu", tenant, "lecturer")
    LecturerCourseAssignment.objects.create(
        tenant=tenant, course_offering=offering, lecturer=lecturer
    )
    other_dept = Department.objects.create(
        tenant=tenant, faculty=dept.faculty, name="Mech", code="ME"
    )
    resp = _upload(
        _auth(lecturer), offering, scope=Resource.Visibility.DEPARTMENT, title="Week 1"
    )
    assert resp.status_code == 201, resp.data
    res = Resource.objects.get(title="Week 1")
    assert res.visibility_scope == Resource.Visibility.DEPARTMENT
    # Client-supplied department (here none) is coerced to the course's own.
    assert res.department_id == course.department_id
    assert res.department_id != other_dept.id


@pytest.mark.django_db
def test_assigned_lecturer_course_scope_ok():
    tenant = _tenant("lcor-u")
    dept, course, offering = _structure(tenant)
    lecturer = _user("l@lcor-u.edu", tenant, "lecturer")
    LecturerCourseAssignment.objects.create(
        tenant=tenant, course_offering=offering, lecturer=lecturer
    )
    resp = _upload(_auth(lecturer), offering, scope=Resource.Visibility.COURSE)
    assert resp.status_code == 201, resp.data


@pytest.mark.django_db
def test_student_department_scope_without_offering_still_allowed():
    tenant = _tenant("stall-u")
    dept, course, offering = _structure(tenant)
    student = _user("stu@stall-u.edu", tenant, "student")
    client = _auth(student)
    resp = client.post(
        "/api/v1/resources/",
        {
            "title": "My drafts",
            "description": "",
            "visibility_scope": Resource.Visibility.DEPARTMENT,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert Resource.objects.get(course_offering__isnull=True).visibility_scope == "department"


@pytest.mark.django_db
def test_cross_tenant_offering_rejected_for_admin():
    tenant_a = _tenant("cross-a")
    tenant_b = _tenant("cross-b")
    dept_b, course_b, offering_b = _structure(tenant_b)
    admin_a = _user("admin@cross-a.edu", tenant_a, "tenant_admin")
    resp = _upload(_auth(admin_a), offering_b, scope=Resource.Visibility.COURSE)
    assert resp.status_code == 400, resp.data
    assert Resource.objects.count() == 0
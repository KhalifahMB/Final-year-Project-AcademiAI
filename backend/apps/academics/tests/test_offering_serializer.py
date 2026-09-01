"""
Serializer contract for the course catalogue + course detail page:

- CourseSerializer exposes department_name.
- CourseOfferingSerializer exposes the owning department (id + name) and
  can_manage_materials (assigned lecturers + admins only).
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import (
    AcademicSession,
    Course,
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
    course = Course.objects.create(tenant=tenant, department=dept, code="CS101", title="Intro to CS")
    offering = CourseOffering.objects.create(
        tenant=tenant, course=course, academic_session=session, semester=semester, status="active"
    )
    return dept, course, offering


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_course_serializer_exposes_department_name():
    tenant = _tenant("cser-u")
    dept, course, offering = _structure(tenant)
    admin = _user("admin@cser-u.edu", tenant, "tenant_admin")
    resp = _auth(admin).get(f"/api/v1/courses/{course.id}/")
    assert resp.status_code == 200
    assert str(resp.data["department"]) == str(dept.id)
    assert resp.data["department_name"] == dept.name


@pytest.mark.django_db
def test_offering_exposes_department_and_can_manage_for_assigned_lecturer():
    tenant = _tenant("off-u")
    dept, course, offering = _structure(tenant)
    lecturer = _user("teach@off-u.edu", tenant, "lecturer")
    LecturerCourseAssignment.objects.create(
        tenant=tenant, course_offering=offering, lecturer=lecturer
    )
    resp = _auth(lecturer).get(f"/api/v1/course-offerings/{offering.id}/")
    assert resp.status_code == 200
    data = resp.data
    assert str(data["department"]) == str(dept.id)
    assert data["department_name"] == dept.name
    assert data["can_manage_materials"] is True


@pytest.mark.django_db
def test_offering_can_manage_false_for_students_and_other_lecturers():
    tenant = _tenant("off2-u")
    dept, course, offering = _structure(tenant)
    student = _user("stu@off2-u.edu", tenant, "student")
    other = _user("other@off2-u.edu", tenant, "lecturer")
    data = _auth(student).get(f"/api/v1/course-offerings/{offering.id}/").data
    assert data["can_manage_materials"] is False
    data2 = _auth(other).get(f"/api/v1/course-offerings/{offering.id}/").data
    assert data2["can_manage_materials"] is False


@pytest.mark.django_db
def test_offering_can_manage_true_for_admins():
    tenant = _tenant("off3-u")
    dept, course, offering = _structure(tenant)
    admin = _user("admin@off3-u.edu", tenant, "tenant_admin")
    data = _auth(admin).get(f"/api/v1/course-offerings/{offering.id}/").data
    assert data["can_manage_materials"] is True


@pytest.mark.django_db
def test_offering_lists_assigned_lecturers():
    tenant = _tenant("off4-u")
    dept, course, offering = _structure(tenant)
    lect = _user("teach@off4-u.edu", tenant, "lecturer")
    coordinator = _user("lead@off4-u.edu", tenant, "lecturer")
    LecturerCourseAssignment.objects.create(tenant=tenant, course_offering=offering, lecturer=lect)
    LecturerCourseAssignment.objects.create(
        tenant=tenant, course_offering=offering, lecturer=coordinator, assignment_role="coordinator"
    )
    student = _user("stu@off4-u.edu", tenant, "student")
    data = _auth(student).get(f"/api/v1/course-offerings/{offering.id}/").data
    lecturers = {(x["id"]): x for x in data["lecturers"]}
    assert set(lecturers) == {str(lect.id), str(coordinator.id)}
    assert lecturers[str(lect.id)]["name"] == lect.full_name
    assert lecturers[str(lect.id)]["email"] == lect.email
    assert lecturers[str(lect.id)]["role"] == "lecturer"
    assert lecturers[str(coordinator.id)]["role"] == "coordinator"


@pytest.mark.django_db
def test_offering_lecturers_empty_when_unassigned():
    tenant = _tenant("off5-u")
    dept, course, offering = _structure(tenant)
    student = _user("stu@off5-u.edu", tenant, "student")
    data = _auth(student).get(f"/api/v1/course-offerings/{offering.id}/").data
    assert data["lecturers"] == []
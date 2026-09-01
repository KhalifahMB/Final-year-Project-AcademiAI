"""
UserSerializer academic-context fields.

The auth payload drives the course catalogue's department filter and the
course-detail upload surface, so it must expose the caller's programme and
department (students inherit from their programme; lecturers from their
profile department; admins/platform users get None).
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import StudentProfile, User
from apps.academics.models import Department, Faculty, Programme
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


def _dept_and_prog(tenant):
    fac = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
    dept = Department.objects.create(tenant=tenant, faculty=fac, name="CS", code="CS")
    prog = Programme.objects.create(tenant=tenant, department=dept, name="BSc CS", code="BSC-CS")
    return dept, prog


def _auth(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_student_exposes_department_from_programme():
    tenant = _tenant("us-team-u")
    dept, prog = _dept_and_prog(tenant)
    student = _user("stu@us-team-u.edu", tenant, "student")
    StudentProfile.objects.create(user=student, tenant=tenant, programme=prog)
    data = _auth(student).get("/api/v1/auth/me/").data
    assert data["programme_id"] == str(prog.id)
    assert data["department_id"] == str(dept.id)
    assert data["department_name"] == dept.name


@pytest.mark.django_db
def test_lecturer_exposes_department_from_profile():
    tenant = _tenant("us-lec-u")
    dept, prog = _dept_and_prog(tenant)
    lecturer = _user("lect@us-lec-u.edu", tenant, "lecturer")
    from apps.accounts.models import LecturerProfile

    LecturerProfile.objects.create(user=lecturer, tenant=tenant, department=dept)
    data = _auth(lecturer).get("/api/v1/auth/me/").data
    assert data["department_id"] == str(dept.id)
    assert data["department_name"] == dept.name
    assert data["programme_id"] is None


@pytest.mark.django_db
def test_admin_and_platform_user_have_no_academic_context():
    tenant = _tenant("us-adm-u")
    admin = _user("admin@us-adm-u.edu", tenant, "tenant_admin")
    data = _auth(admin).get("/api/v1/auth/me/").data
    assert data["programme_id"] is None
    assert data["department_id"] is None
    assert data["department_name"] is None


@pytest.mark.django_db
def test_serializer_exposes_active_state():
    tenant = _tenant("us-act-u")
    active = _user("active@us-act-u.edu", tenant, "student")
    inactive = _user("gone@us-act-u.edu", tenant, "student")
    inactive.is_active = False
    inactive.save()

    a = _auth(active).get("/api/v1/auth/me/").data
    assert a["is_active"] is True

    admin = _user("adm@us-act-u.edu", tenant, "tenant_admin")
    from apps.accounts.serializers import UserSerializer

    payload = UserSerializer(inactive, context={"request": None}).data
    assert payload["is_active"] is False
"""
End-to-end cross-tenant isolation tests over the REST API (IDOR matrix).

Tenant A user → Tenant A data = allowed when otherwise authorized
Tenant A user → Tenant B data = denied
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import Faculty
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _make_tenant(slug):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def _make_user(email, tenant, role="tenant_admin"):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        is_active=True,
        is_email_verified=True,
    )


@pytest.fixture
def two_tenants(db):
    ta = _make_tenant("univ-a")
    tb = _make_tenant("univ-b")
    return {"a": ta, "b": tb}


def _auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_admin_cannot_retrieve_other_tenants_faculty(two_tenants):
    faculty_b = Faculty.objects.create(
        tenant=two_tenants["b"], name="Engineering B", code="ENG"
    )
    admin_a = _make_user("admin-a@univa.edu", two_tenants["a"])
    client = _auth_client(admin_a)

    resp = client.get(f"/api/v1/faculties/{faculty_b.id}/")
    assert resp.status_code == 404

    listing = client.get("/api/v1/faculties/")
    ids = [r["id"] for r in listing.data["results"]]
    assert str(faculty_b.id) not in ids


@pytest.mark.django_db
def test_admin_cannot_modify_or_delete_other_tenants_faculty(two_tenants):
    faculty_b = Faculty.objects.create(
        tenant=two_tenants["b"], name="Science B", code="SCI"
    )
    admin_a = _make_user("admin-a2@univa.edu", two_tenants["a"])
    client = _auth_client(admin_a)

    assert client.patch(
        f"/api/v1/faculties/{faculty_b.id}/", {"name": "Hacked"}, format="json"
    ).status_code == 404
    assert client.delete(f"/api/v1/faculties/{faculty_b.id}/").status_code == 404

    faculty_b.refresh_from_db()
    assert faculty_b.name == "Science B"


@pytest.mark.django_db
def test_student_cannot_create_academic_structure(two_tenants):
    student_a = _make_user(
        "stud-a@univa.edu", two_tenants["a"], role="student"
    )
    client = _auth_client(student_a)

    resp = client.post(
        "/api/v1/faculties/", {"name": "Law", "code": "LAW"}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_can_create_faculty_in_own_tenant_only(two_tenants):
    admin_a = _make_user("admin-a3@univa.edu", two_tenants["a"])
    client = _auth_client(admin_a)

    resp = client.post(
        "/api/v1/faculties/", {"name": "Law", "code": "LAW"}, format="json"
    )
    assert resp.status_code == 201
    faculty = Faculty.objects.get(id=resp.data["id"])
    assert faculty.tenant_id == two_tenants["a"].id


@pytest.mark.django_db
def test_manipulated_tenant_id_is_ignored_on_create(two_tenants):
    admin_a = _make_user("admin-a4@univa.edu", two_tenants["a"])
    client = _auth_client(admin_a)

    resp = client.post(
        "/api/v1/faculties/",
        {
            "name": "Spoofed",
            "code": "SPF",
            "tenant": str(two_tenants["b"].id),
        },
        format="json",
    )
    assert resp.status_code == 201
    faculty = Faculty.objects.get(id=resp.data["id"])
    # Tenant is always derived server-side from authenticated membership.
    assert faculty.tenant_id == two_tenants["a"].id


@pytest.mark.django_db
def test_notes_are_private_per_user(two_tenants):
    from apps.learning.models import Note

    user_a1 = _make_user("a1@univa.edu", two_tenants["a"], role="student")
    user_a2 = _make_user("a2@univa.edu", two_tenants["a"], role="student")

    Note.objects.create(tenant=two_tenants["a"], user=user_a1, title="T", content="C")

    client = _auth_client(user_a2)
    resp = client.get("/api/v1/notes/")
    assert all(n["user"] == str(user_a2.id) or n["user"] is None for n in resp.data["results"]) or len(resp.data["results"]) == 0

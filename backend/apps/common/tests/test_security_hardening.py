"""
Security regression tests for the hardening pass:

- self-service role escalation via PATCH /auth/me must be impossible
- signup must always create students (role cannot be chosen)
- complete_upload must reject storage keys outside the resource's tenant path
- job results may only be read by the user who dispatched them
- quiz attempts are student-only
"""
import pytest
from unittest.mock import patch

from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import Faculty
from apps.resources.models import Resource, ResourceVersion
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _tenant(slug):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def _user(email, tenant, role="student", verified=True):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        tenant=tenant,
        role=role,
        is_active=True,
        is_email_verified=verified,
    )


@pytest.mark.django_db
def test_me_patch_cannot_change_role():
    t = _tenant("esc")
    student = _user("stud@esc.edu", t)
    client = APIClient()
    client.force_authenticate(student)

    resp = client.patch(
        "/api/v1/auth/me/", {"role": "admin", "first_name": "New"}, format="json"
    )
    assert resp.status_code == 200
    student.refresh_from_db()
    assert student.role == "student"  # unchanged
    assert student.first_name == "New"  # allowed field applied


@pytest.mark.django_db
def test_signup_ignores_client_role():
    _tenant("signup-role")
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/signup/",
        {
            "email": "evil@signup-role.edu",
            "password": PASSWORD,
            "tenant_slug": "signup-role",
            "role": "admin",
        },
        format="json",
    )
    assert resp.status_code == 201
    user = User.objects.get(email="evil@signup-role.edu")
    assert user.role == "student"


@pytest.mark.django_db
def test_complete_upload_rejects_foreign_storage_key():
    ta = _tenant("up-a")
    tb = _tenant("up-b")
    admin_b = _user("admin-b@upb.edu", tb, role="admin")

    # A resource in tenant A with a key inside tenant B's partition.
    res_a = Resource.objects.create(tenant=ta, title="A doc", uploaded_by=None)
    foreign_key = f"tenants/{ta.id}/resources/{res_a.id}/../{tb.id}/x.pdf"
    other_tenant_key = f"tenants/{tb.id}/resources/{res_a.id}/stolen.pdf"

    client = APIClient()
    client.force_authenticate(admin_b)  # tenant B user
    # Tenant B user cannot even touch tenant A's resource.
    resp = client.post(
        f"/api/v1/resources/{res_a.id}/complete_upload/",
        {"storage_key": other_tenant_key},
        format="json",
    )
    assert resp.status_code == 404  # hidden by tenant scoping

    # Tenant A user cannot claim a key pointing at another tenant's partition.
    admin_a = _user("admin-a@upa.edu", ta, role="admin")
    client.force_authenticate(admin_a)
    resp = client.post(
        f"/api/v1/resources/{res_a.id}/complete_upload/",
        {"storage_key": f"tenants/{tb.id}/resources/whatever/x.pdf"},
        format="json",
    )
    assert resp.status_code == 400
    assert ResourceVersion.objects.filter(resource=res_a).count() == 0


@pytest.mark.django_db
@patch("apps.resources.tasks.process_resource_ingestion.delay")
def test_complete_upload_accepts_own_key_and_claims_job(mock_delay):
    mock_delay.return_value.id = "task-123"
    ta = _tenant("up-c")
    admin_a = _user("a@upc.edu", ta, role="admin")
    res = Resource.objects.create(tenant=ta, title="C doc", uploaded_by=admin_a)

    own_key = f"tenants/{ta.id}/resources/{res.id}/abc-123"
    client = APIClient()
    client.force_authenticate(admin_a)
    resp = client.post(
        f"/api/v1/resources/{res.id}/complete_upload/",
        {"storage_key": own_key},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["job_id"] == "task-123"
    version = ResourceVersion.objects.get(resource=res)
    assert version.storage_key == own_key


@pytest.mark.django_db
def test_job_status_denied_for_non_owner(settings):
    from django.core.cache import cache

    ta = _tenant("jobs")
    owner = _user("owner@jobs.edu", ta)
    intruder = _user("intruder@jobs.edu", ta)

    cache.set("job-owner:task-xyz", str(owner.id), 600)

    client = APIClient()
    client.force_authenticate(intruder)
    resp = client.get("/api/v1/jobs/task-xyz/")
    assert resp.status_code == 404

    client.force_authenticate(owner)
    resp = client.get("/api/v1/jobs/task-xyz/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_staff_cannot_start_quiz_attempt():
    from apps.assessments.models import Quiz

    t = _tenant("quiz-role")
    lecturer = _user("lec@quiz.edu", t, role="lecturer")
    quiz = Quiz.objects.create(tenant=t, title="Q1", created_by=lecturer)

    client = APIClient()
    client.force_authenticate(lecturer)
    resp = client.post("/api/v1/quiz-attempts/", {"quiz": str(quiz.id)}, format="json")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_student_cannot_read_other_users_notes():
    from apps.learning.models import Note

    t = _tenant("notes")
    u1 = _user("u1@notes.edu", t)
    u2 = _user("u2@notes.edu", t)
    Note.objects.create(tenant=t, user=u2, title="Private", content="Secret")

    client = APIClient()
    client.force_authenticate(u1)
    resp = client.get("/api/v1/notes/")
    titles = [n["title"] for n in resp.data["results"]]
    assert "Private" not in titles

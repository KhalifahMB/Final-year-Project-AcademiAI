"""
Regression tests for student uploads and resource ownership rules.
"""
import pytest
from unittest.mock import patch

from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.resources.models import Resource
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


@pytest.mark.django_db
def test_student_can_create_resource():
    t = Tenant.objects.create(name="T", slug="stu-up")
    student = User.objects.create_user(
        email="s@stu-up.edu", password=PASSWORD, tenant=t, is_email_verified=True
    )
    client = APIClient()
    client.force_authenticate(student)

    resp = client.post(
        "/api/v1/resources/",
        {"title": "Lecture notes", "visibility_scope": "private"},
        format="json",
    )
    assert resp.status_code == 201
    assert str(resp.data["uploaded_by"]) == str(student.id)


@pytest.mark.django_db
@patch("apps.resources.tasks.process_resource_ingestion.delay")
def test_student_full_upload_lifecycle(mock_delay):
    mock_delay.return_value.id = "task-stu"
    t = Tenant.objects.create(name="T2", slug="stu-life")
    student = User.objects.create_user(
        email="s2@t2.edu", password=PASSWORD, tenant=t, is_email_verified=True
    )
    client = APIClient()
    client.force_authenticate(student)

    # 1. create metadata
    resp = client.post(
        "/api/v1/resources/", {"title": "Slides", "visibility_scope": "private"}, format="json"
    )
    rid = resp.data["id"]

    # 2. request presign — key must be inside the student's own partition
    resp = client.post(
        f"/api/v1/resources/{rid}/request_upload_url/",
        {"content_type": "application/pdf"},
        format="json",
    )
    assert resp.status_code == 200
    key = resp.data["storage_key"]
    assert key.startswith(f"tenants/{t.id}/resources/{rid}/")

    # 3. complete with the issued key
    resp = client.post(f"/api/v1/resources/{rid}/complete_upload/",
                       {"storage_key": key}, format="json")
    assert resp.status_code == 200
    resource = Resource.objects.get(id=rid)
    assert resource.storage_key == key


@pytest.mark.django_db
def test_student_cannot_delete_other_users_resource():
    t = Tenant.objects.create(name="T3", slug="own-guard")
    owner = User.objects.create_user(
        email="o@t3.edu", password=PASSWORD, tenant=t, role="student", is_email_verified=True
    )
    other = User.objects.create_user(
        email="x@t3.edu", password=PASSWORD, tenant=t, role="student", is_email_verified=True
    )
    res = Resource.objects.create(tenant=t, title="Mine", uploaded_by=owner)

    client = APIClient()
    client.force_authenticate(other)
    assert client.delete(f"/api/v1/resources/{res.id}/").status_code == 403
    res.refresh_from_db()  # still exists

    # Owner can delete their own
    client.force_authenticate(owner)
    assert client.delete(f"/api/v1/resources/{res.id}/").status_code == 204

    # Admin can delete anyone's in-tenant resource
    res2 = Resource.objects.create(tenant=t, title="Mine2", uploaded_by=owner)
    admin = User.objects.create_user(
        email="a@t3.edu", password=PASSWORD, tenant=t, role="admin", is_email_verified=True
    )
    client.force_authenticate(admin)
    assert client.delete(f"/api/v1/resources/{res2.id}/").status_code == 204


@pytest.mark.django_db
def test_student_can_request_summary_of_tenant_resource():
    t = Tenant.objects.create(name="T4", slug="sum-stu")
    uploader = User.objects.create_user(
        email="u@t4.edu", password=PASSWORD, tenant=t, role="lecturer", is_email_verified=True
    )
    student = User.objects.create_user(
        email="s@t4.edu", password=PASSWORD, tenant=t, is_email_verified=True
    )
    res = Resource.objects.create(
        tenant=t, title="Shared notes", uploaded_by=uploader,
        visibility_scope="institution", processing_status="ready",
    )

    from django.core.cache import cache
    cache.clear()

    with patch("apps.resources.summary_tasks.summarize_resource_task.delay") as delay:
        delay.return_value.id = "task-sum"
        client = APIClient()
        client.force_authenticate(student)
        resp = client.post(f"/api/v1/resources/{res.id}/summarize/")
        assert resp.status_code == 202
        job_id = resp.data["job_id"]

    # The dispatching student owns the job and can poll it.
    client.force_authenticate(student)
    resp = client.get(f"/api/v1/jobs/{job_id}/")
    assert resp.status_code == 200

"""Bookmark folders (TC-27): folder is an optional organizational label.
Bookmarks remain unique per (user, resource); folder buckets them in listings.
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.resources.models import Resource
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _setup(role=User.Role.STUDENT):
    tenant = Tenant.objects.create(name="Univ bm", slug="bm-u")
    user = User.objects.create_user(
        email="bm@u.com", password=PASSWORD, tenant=tenant,
        role=role, is_active=True, is_email_verified=True,
    )
    r1 = Resource.objects.create(
        tenant=tenant, uploaded_by=user, title="Paper A",
        visibility_scope=Resource.Visibility.INSTITUTION,
        processing_status=Resource.ProcessingStatus.READY,
    )
    r2 = Resource.objects.create(
        tenant=tenant, uploaded_by=user, title="Paper B",
        visibility_scope=Resource.Visibility.INSTITUTION,
        processing_status=Resource.ProcessingStatus.READY,
    )
    return tenant, user, r1, r2


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_bookmark_with_folder_created_and_listed():
    tenant, user, r1, r2 = _setup()
    client = _client(user)

    resp = client.post(
        "/api/v1/bookmarks/",
        {"resource": str(r1.id), "folder": "research"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["folder"] == "research"
    assert str(resp.data["user"]) == str(user.id)

    resp2 = client.post(
        "/api/v1/bookmarks/", {"resource": str(r2.id), "folder": "inbox"}, format="json",
    )
    assert resp2.status_code == 201

    by_folder = client.get("/api/v1/bookmarks/?folder=research").json()
    results = by_folder["results"]
    assert len(results) == 1
    assert results[0]["resource"] == str(r1.id)

    all_bm = client.get("/api/v1/bookmarks/").json()
    assert len(all_bm["results"]) == 2


@pytest.mark.django_db
def test_bookmark_folder_default_blank():
    tenant, user, r1, _ = _setup()
    resp = _client(user).post(
        "/api/v1/bookmarks/", {"resource": str(r1.id)}, format="json",
    )
    assert resp.status_code == 201
    assert resp.data["folder"] == ""


@pytest.mark.django_db
def test_folder_filter_owner_scoped():
    tenant, user, r1, r2 = _setup()
    other = User.objects.create_user(
        email="other@u.com", password=PASSWORD, tenant=tenant,
        role="student", is_active=True, is_email_verified=True,
    )
    _client(user).post(
        "/api/v1/bookmarks/", {"resource": str(r1.id), "folder": "shared-ish"}, format="json",
    )
    # Other user's folder listing must be empty even if names collide.
    resp = _client(other).get("/api/v1/bookmarks/?folder=shared-ish").json()
    assert resp["results"] == []
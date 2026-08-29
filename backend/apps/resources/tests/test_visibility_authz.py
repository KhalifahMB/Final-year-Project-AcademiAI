"""Visibility regression: private resources are visible only to their uploader.

Applies to every role, including tenant admins and platform superusers.
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.resources.models import Resource
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _make_tenant(slug="univ-x"):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def _make_user(email, tenant, role=User.Role.STUDENT, superuser=False):
    if superuser:
        return User.objects.create_superuser(email=email, password=PASSWORD, tenant=tenant)
    return User.objects.create_user(
        email=email, password=PASSWORD, tenant=tenant,
        role=role, is_active=True, is_email_verified=True,
    )


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _priv(tenant, owner, title, scope=Resource.Visibility.PRIVATE):
    return Resource.objects.create(
        tenant=tenant, uploaded_by=owner, title=title,
        visibility_scope=scope, processing_status=Resource.ProcessingStatus.READY,
    )


def _titles(resp):
    data = resp.data.get("results", resp.data) if isinstance(resp.data, dict) else resp.data
    return {r["title"] for r in data}


@pytest.mark.django_db
def test_student_sees_own_private_only():
    tenant = _make_tenant()
    a = _make_user("a@x.com", tenant)
    b = _make_user("b@x.com", tenant)
    mine = _priv(tenant, a, "A private")
    _priv(tenant, b, "B private")

    resp = _client(a).get("/api/v1/resources/")
    assert resp.status_code == 200
    titles = _titles(resp)
    assert mine.title in titles
    assert "B private" not in titles


@pytest.mark.django_db
def test_admin_does_not_see_others_private():
    tenant = _make_tenant()
    admin = _make_user("admin@x.com", tenant, role=User.Role.ADMIN)
    b = _make_user("b@x.com", tenant)
    shared = _priv(tenant, b, "B shared", scope=Resource.Visibility.INSTITUTION)
    _priv(tenant, b, "B private")
    own = _priv(tenant, admin, "Admin private")

    resp = _client(admin).get("/api/v1/resources/")
    assert resp.status_code == 200
    titles = _titles(resp)
    assert shared.title in titles          # admin still sees other scopes
    assert own.title in titles             # admin sees their own private
    assert "B private" not in titles       # but NOT another user's private


@pytest.mark.django_db
def test_superuser_does_not_see_others_private():
    tenant = _make_tenant()
    su = _make_user("su@x.com", tenant, superuser=True)
    b = _make_user("b@x.com", tenant)
    _priv(tenant, b, "B private")
    _priv(tenant, su, "SU private")

    resp = _client(su).get("/api/v1/resources/")
    assert resp.status_code == 200
    titles = _titles(resp)
    assert "B private" not in titles
    assert "SU private" in titles


@pytest.mark.django_db
def test_retrieve_rejects_others_private_for_admin():
    tenant = _make_tenant()
    admin = _make_user("admin@x.com", tenant, role=User.Role.ADMIN)
    b = _make_user("b@x.com", tenant)
    theirs = _priv(tenant, b, "B private")

    resp = _client(admin).get(f"/api/v1/resources/{theirs.id}/")
    assert resp.status_code in (403, 404)

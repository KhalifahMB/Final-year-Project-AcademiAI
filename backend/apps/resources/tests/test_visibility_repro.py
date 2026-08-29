import pytest
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.resources.models import Resource
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"
def _make_tenant(slug="univ-x"):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)
def _make_user(email, tenant, role=User.Role.STUDENT):
    return User.objects.create_user(email=email, password=PASSWORD, tenant=tenant, role=role, is_active=True, is_email_verified=True)
def _client(user):
    c = APIClient(); c.force_authenticate(user=user); return c
def _priv(tenant, owner, title):
    return Resource.objects.create(tenant=tenant, uploaded_by=owner, title=title, visibility_scope=Resource.Visibility.PRIVATE, processing_status=Resource.ProcessingStatus.READY)

@pytest.mark.django_db
def test_list_does_not_leak_other_users_private():
    tenant = _make_tenant()
    a = _make_user("a@x.com", tenant)
    b = _make_user("b@x.com", tenant)
    mine = _priv(tenant, a, "A private")
    theirs = _priv(tenant, b, "B private")
    resp = _client(a).get("/api/v1/resources/")
    assert resp.status_code == 200
    data = resp.data.get("results", resp.data)
    ids = {r["id"] for r in data}
    assert str(mine.id) in ids
    assert str(theirs.id) not in ids, "LEAK: returned another user's private resource"

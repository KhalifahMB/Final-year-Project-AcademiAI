"""
Tenant provisioning & lifecycle rules.

Tenants are provisioned exclusively through tenant-request approval — there is
no ad-hoc create/destroy endpoint. Only the platform superuser may change a
tenant's status (suspend / reactivate); all other tenant details are read-only.
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _make_tenant(slug="univ-x", **kwargs):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug, **kwargs)


def _make_admin(email, tenant):
    return User.objects.create_user(
        email=email, password=PASSWORD, tenant=tenant,
        role=User.Role.TENANT_ADMIN, is_active=True, is_email_verified=True,
    )


def _make_superuser(email, tenant):
    return User.objects.create_superuser(
        email=email, password=PASSWORD, tenant=tenant,
    )


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_post_tenants_disabled_even_for_superuser():
    t = _make_tenant()
    superuser = _make_superuser("boss@platform.edu", t)
    resp = _client(superuser).post(
        "/api/v1/tenants/",
        {"name": "Rogue", "slug": "rogue", "plan": "pro"},
        format="json",
    )
    assert resp.status_code == 405, resp.data
    assert Tenant.objects.filter(slug="rogue").count() == 0


@pytest.mark.django_db
def test_delete_tenant_disabled_even_for_superuser():
    t = _make_tenant()
    superuser = _make_superuser("boss2@platform.edu", t)
    resp = _client(superuser).delete(f"/api/v1/tenants/{t.id}/")
    assert resp.status_code == 405, resp.data
    assert Tenant.objects.filter(id=t.id).exists()


@pytest.mark.django_db
def test_tenant_admin_cannot_set_status():
    t = _make_tenant()
    admin = _make_admin("admin@univ-x.edu", t)
    resp = _client(admin).patch(
        f"/api/v1/tenants/{t.id}/", {"status": "suspended"}, format="json"
    )
    assert resp.status_code == 403, resp.data
    t.refresh_from_db()
    assert t.status == Tenant.Status.ACTIVE


@pytest.mark.django_db
def test_tenant_admin_cannot_edit_own_name_or_domain():
    t = _make_tenant()
    admin = _make_admin("admin2@univ-x.edu", t)
    resp = _client(admin).patch(
        f"/api/v1/tenants/{t.id}/",
        {"name": "Hacked", "domain": "evil.example.com"},
        format="json",
    )
    assert resp.status_code == 403, resp.data
    t.refresh_from_db()
    assert t.name == f"Univ univ-x"


@pytest.mark.django_db
def test_superuser_can_suspend_and_reactivate():
    t = _make_tenant()
    superuser = _make_superuser("boss3@platform.edu", t)
    c = _client(superuser)

    assert c.patch(f"/api/v1/tenants/{t.id}/", {"status": "suspended"}, format="json").status_code == 200
    t.refresh_from_db()
    assert t.status == Tenant.Status.SUSPENDED
    assert t.suspended_at is not None

    assert c.patch(f"/api/v1/tenants/{t.id}/", {"status": "active"}, format="json").status_code == 200
    t.refresh_from_db()
    assert t.status == Tenant.Status.ACTIVE
    assert t.suspended_at is None


@pytest.mark.django_db
def test_superuser_cannot_edit_plan_or_details():
    t = _make_tenant(status=Tenant.Status.ACTIVE)
    superuser = _make_superuser("boss4@platform.edu", t)
    resp = _client(superuser).patch(
        f"/api/v1/tenants/{t.id}/",
        {"plan": "enterprise", "storage_quota_bytes": 500 * 1024 ** 3, "name": "Renamed"},
        format="json",
    )
    assert resp.status_code in (200, 400), resp.data
    t.refresh_from_db()
    assert t.plan != "enterprise"
    assert t.name == f"Univ univ-x"

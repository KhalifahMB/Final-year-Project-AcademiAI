"""
Role-aware tenant detail endpoint (PlatformTenantDetailView).

Platform operators see operational usage stats only; a tenant's own admin sees
the full internal structure. Everyone else is forbidden.
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
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


def _make_superuser(email):
    user = User.objects.create_user(
        email=email,
        password=PASSWORD,
        is_active=True,
        is_email_verified=True,
    )
    user.is_superuser = True
    user.is_staff = True
    user.save(update_fields=["is_superuser", "is_staff"])
    return user


def _auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _detail_url(tenant):
    return f"/api/v1/platform/tenants/{tenant.id}/"


@pytest.fixture
def tenants(db):
    a = _make_tenant("univ-a")
    b = _make_tenant("univ-b")
    return {"a": a, "b": b}


@pytest.mark.django_db
def test_platform_operator_sees_only_operational_stats(tenants):
    client = _auth_client(_make_superuser("ops@academiai.test"))
    resp = client.get(_detail_url(tenants["a"]))

    assert resp.status_code == 200
    data = resp.data
    assert data["tenant"]["id"] == str(tenants["a"].id)
    assert data["structure_visible"] is False
    assert "users" in data["stats"]
    assert "resources" in data["stats"]
    assert "quizzes" in data["stats"]
    # Internal structure must be withheld from platform operators.
    assert "academic" not in data["stats"]
    assert "chat" not in data["stats"]
    assert "chunks" not in data["stats"]["resources"]


@pytest.mark.django_db
def test_tenant_admin_of_that_tenant_sees_full_structure(tenants):
    admin = _make_user("admin-a@univa.edu", tenants["a"])
    client = _auth_client(admin)
    resp = client.get(_detail_url(tenants["a"]))

    assert resp.status_code == 200
    data = resp.data
    assert data["structure_visible"] is True
    assert "academic" in data["stats"]
    assert "chat" in data["stats"]
    assert "chunks" in data["stats"]["resources"]


@pytest.mark.django_db
def test_admin_of_other_tenant_is_forbidden(tenants):
    admin_b = _make_user("admin-b@univb.edu", tenants["b"])
    client = _auth_client(admin_b)
    resp = client.get(_detail_url(tenants["a"]))

    assert resp.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["student", "lecturer"])
def test_non_admin_members_are_forbidden(tenants, role):
    user = _make_user(f"{role}@univa.edu", tenants["a"], role=role)
    client = _auth_client(user)
    resp = client.get(_detail_url(tenants["a"]))

    assert resp.status_code == 403


@pytest.mark.django_db
def test_anonymous_is_forbidden(tenants):
    # IsAuthenticated responds 401 for unauthenticated requests.
    resp = APIClient().get(_detail_url(tenants["a"]))
    assert resp.status_code == 401


@pytest.mark.django_db
def test_unknown_tenant_is_404(tenants):
    client = _auth_client(_make_superuser("ops@academiai.test"))
    resp = client.get("/api/v1/platform/tenants/00000000-0000-0000-0000-000000000000/")
    assert resp.status_code == 404
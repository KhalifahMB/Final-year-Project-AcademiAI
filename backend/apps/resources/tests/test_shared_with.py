"""
TC-24 (per-user sharing) + TC-22 (tenant-scoped resource GET caching).

Sharing is expressed through ResourcePermission rows with a concrete user
(permission="read"); only the uploader or a tenant admin may grant. A shared
resource is readable by the grantee regardless of scope (even private), while
everyone else keeps their existing visibility. Caching is authorization-first:
the detail payload is cached per (tenant, user, resource, updated_at).
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.resources.models import Resource, ResourcePermission
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026"


def _tenant(slug):
    return Tenant.objects.create(name=f"Univ {slug}", slug=slug)


def _user(email, tenant, role=User.Role.STUDENT):
    return User.objects.create_user(
        email=email, password=PASSWORD, tenant=tenant,
        role=role, is_active=True, is_email_verified=True,
    )


def _resource(tenant, owner, title, scope=Resource.Visibility.PRIVATE):
    return Resource.objects.create(
        tenant=tenant, uploaded_by=owner, title=title,
        visibility_scope=scope, processing_status=Resource.ProcessingStatus.READY,
    )


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_shared_private_resource_readable_only_by_sharee():
    tenant = _tenant("sharee-only")
    owner = _user("owner@u.com", tenant, role=User.Role.LECTURER)
    sharee = _user("x@u.com", tenant)
    stranger = _user("y@u.com", tenant)
    res = _resource(tenant, owner, "Shared private doc")

    # Owner grants read to X.
    resp = _client(owner).patch(
        f"/api/v1/resources/{res.id}/",
        {"shared_with": ["x@u.com"]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    emails = {u["email"] for u in resp.data["shared_with_users"]}
    assert emails == {"x@u.com"}

    # X can now read (and list) the private material; Y still 404s.
    assert _client(sharee).get(f"/api/v1/resources/{res.id}/").status_code == 200
    assert _client(stranger).get(f"/api/v1/resources/{res.id}/").status_code in (403, 404)

    listed = _client(sharee).get("/api/v1/resources/").json()
    titles = {r["title"] for r in listed["results"]}
    assert "Shared private doc" in titles

    listed_y = _client(stranger).get("/api/v1/resources/").json()
    assert "Shared private doc" not in {r["title"] for r in listed_y["results"]}


@pytest.mark.django_db
def test_unshare_removes_grant():
    tenant = _tenant("unshare")
    owner = _user("owner@u.com", tenant, role=User.Role.LECTURER)
    sharee = _user("x@u.com", tenant)
    res = _resource(tenant, owner, "Temp shared")

    _client(owner).patch(
        f"/api/v1/resources/{res.id}/", {"shared_with": ["x@u.com"]}, format="json",
    )
    assert _client(sharee).get(f"/api/v1/resources/{res.id}/").status_code == 200

    resp = _client(owner).patch(
        f"/api/v1/resources/{res.id}/", {"shared_with": []}, format="json",
    )
    assert resp.status_code == 200
    assert resp.data["shared_with_users"] == []
    assert _client(sharee).get(f"/api/v1/resources/{res.id}/").status_code in (403, 404)


@pytest.mark.django_db
def test_non_owner_cannot_grant_share():
    tenant = _tenant("no-grant")
    owner = _user("owner@u.com", tenant, role=User.Role.LECTURER)
    attacker = _user("attacker@u.com", tenant, role=User.Role.STUDENT)
    res = _resource(tenant, owner, "Owner doc")

    resp = _client(attacker).patch(
        f"/api/v1/resources/{res.id}/",
        {"shared_with": ["attacker@u.com"]},
        format="json",
    )
    # IsOwnerOrAdminForWrite rejects the whole write.
    assert resp.status_code in (403, 404)
    assert ResourcePermission.objects.filter(resource=res, user=attacker).count() == 0


@pytest.mark.django_db
def test_cross_tenant_email_dropped_from_share():
    tenant_a = _tenant("cross-a")
    tenant_b = _tenant("cross-b")
    owner = _user("owner@a.edu", tenant_a, role=User.Role.LECTURER)
    outsider = _user("outsider@b.edu", tenant_b)
    res = _resource(tenant_a, owner, "A doc")

    resp = _client(owner).patch(
        f"/api/v1/resources/{res.id}/",
        {"shared_with": ["outsider@b.edu"]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    # The outsider is not in the owner's tenant, so no grant row is created.
    assert ResourcePermission.objects.filter(resource=res, user=outsider).count() == 0


@pytest.mark.django_db
def test_detail_get_cached_per_user_and_invalidated_on_write():
    cache.clear()
    tenant = _tenant("cached")
    owner = _user("owner@u.com", tenant, role=User.Role.LECTURER)
    res = _resource(tenant, owner, "Cached doc", scope=Resource.Visibility.INSTITUTION)

    r1 = _client(owner).get(f"/api/v1/resources/{res.id}/")
    assert r1.status_code == 200

    ts = res.updated_at.isoformat()
    key = f"res:{res.tenant_id}:{owner.id}:{res.pk}:{ts}"
    assert cache.get(key) is not None
    assert cache.get(key) == r1.data

    # Second read is served from cache (same key, no rewrite).
    r2 = _client(owner).get(f"/api/v1/resources/{res.id}/")
    assert r2.data == r1.data

    # Any write changes updated_at -> a fresh key is used, so the stale
    # entry is never served again (it keeps its TTL, then expires).
    _client(owner).patch(
        f"/api/v1/resources/{res.id}/",
        {"description": "updated"},
        format="json",
    )
    res.refresh_from_db()
    assert res.description == "updated"
    new_key = f"res:{res.tenant_id}:{owner.id}:{res.pk}:{res.updated_at.isoformat()}"
    assert new_key != key

    r3 = _client(owner).get(f"/api/v1/resources/{res.id}/")
    assert r3.status_code == 200
    assert r3.data["description"] == "updated"
    # Fresh read populated the new versioned key.
    assert cache.get(new_key) == r3.data


@pytest.mark.django_db
def test_cache_key_is_user_scoped_private_resource_not_leaked():
    cache.clear()
    tenant = _tenant("leak-guard")
    owner = _user("owner@u.com", tenant, role=User.Role.LECTURER)
    other = _user("other@u.com", tenant)
    res = _resource(tenant, owner, "Private cached")

    assert _client(owner).get(f"/api/v1/resources/{res.id}/").status_code == 200
    assert _client(other).get(f"/api/v1/resources/{res.id}/").status_code in (403, 404)
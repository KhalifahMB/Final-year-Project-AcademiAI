"""Tenant isolation unit tests."""
from apps.common.permissions import TenantObjectPermission


class Dummy:
    def __init__(self, tenant_id):
        self.tenant_id = tenant_id


class Req:
    def __init__(self, tenant_id):
        self.user = type("U", (), {"tenant_id": tenant_id, "is_authenticated": True})()


def test_tenant_object_permission_blocks_other_tenant():
    perm = TenantObjectPermission()
    req = Req("tenant-a")
    obj = Dummy("tenant-b")
    assert perm.has_object_permission(req, None, obj) is False


def test_tenant_object_permission_allows_same_tenant():
    perm = TenantObjectPermission()
    req = Req("tenant-a")
    obj = Dummy("tenant-a")
    assert perm.has_object_permission(req, None, obj) is True

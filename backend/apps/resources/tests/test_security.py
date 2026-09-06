"""
Security / IDOR regression tests for resource visibility and ownership.

These tests exercise the authorization matrix defined in
apps/resources/views._authorized_resources_q and enforced on every
resource-scoped endpoint (preview/download/summaries/versions/upload).

Run with: pytest apps/resources/tests/test_security.py -v
"""
import pytest
from django.forms import model_to_dict
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.resources.models import Resource
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026x"


def _make_student(tenant, email, **kwargs):
    return User.objects.create_user(
        email=email, password=PASSWORD, role="student", tenant=tenant,
        first_name=email.split("@")[0], last_name="S", is_email_verified=True,
        **kwargs,
    )


def _make_resource(owner, scope, **kwargs):
    defaults = dict(
        tenant=owner.tenant,
        title=f"{scope} doc",
        description="t",
        visibility_scope=scope,
        mime_type="application/pdf",
        processing_status=Resource.ProcessingStatus.READY,
        has_extractable_text=True,
        storage_key="tenants/{}/resources/{}/stub".format(owner.tenant_id, "x"),
    )
    defaults.update(kwargs)
    return Resource.objects.create(**defaults)


def _login(client, user):
    r = client.post("/api/v1/auth/login/", {"email": user.email, "password": PASSWORD}, format="json")
    assert r.status_code == 200, r.data
    return r.data["access"]


@pytest.mark.django_db
class TestResourceVisibilityIDOR:
    def test_private_resource_hidden_from_other_students(self):
        tenant = Tenant.objects.create(name="T", slug="t")
        alice = _make_student(tenant, "a@t.edu")
        bob = _make_student(tenant, "b@t.edu")
        r_priv = _make_resource(alice, Resource.Visibility.PRIVATE, uploaded_by=alice)
        r_inst = _make_resource(alice, Resource.Visibility.INSTITUTION, uploaded_by=alice)

        client = APIClient()
        token = _login(client, bob)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # List should NOT contain alice's private resource
        resp = client.get("/api/v1/resources/")
        assert resp.status_code == 200, resp.data
        ids = [x["id"] for x in resp.data["results"]]
        assert str(r_priv.id) not in ids
        assert str(r_inst.id) in ids

        # Direct GET on private resource returns 404
        resp = client.get(f"/api/v1/resources/{r_priv.id}/")
        assert resp.status_code == 404

        # Summaries endpoint also 404 for private
        resp = client.get(f"/api/v1/resources/{r_priv.id}/summaries/")
        assert resp.status_code == 404

        # Versions endpoint 404 for private
        resp = client.get(f"/api/v1/resources/{r_priv.id}/versions/")
        assert resp.status_code == 404

    def test_cross_tenant_resource_returns_404(self):
        t1 = Tenant.objects.create(name="T1", slug="t1")
        t2 = Tenant.objects.create(name="T2", slug="t2")
        alice = _make_student(t1, "a@t1.edu")
        bob = _make_student(t2, "b@t2.edu")
        r = _make_resource(alice, Resource.Visibility.INSTITUTION, uploaded_by=alice)

        client = APIClient()
        token = _login(client, bob)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Even institution-wide resources must NOT leak across tenants
        assert client.get(f"/api/v1/resources/{r.id}/").status_code == 404
        assert client.get(f"/api/v1/resources/{r.id}/summaries/").status_code == 404
        assert client.get(f"/api/v1/resources/{r.id}/versions/").status_code == 404

    def test_non_owner_cannot_issue_presign(self):
        tenant = Tenant.objects.create(name="T", slug="t")
        alice = _make_student(tenant, "a@t.edu")
        bob = _make_student(tenant, "b@t.edu")
        r = _make_resource(alice, Resource.Visibility.PRIVATE, uploaded_by=alice)

        client = APIClient()
        token = _login(client, bob)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        resp = client.post(f"/api/v1/resources/{r.id}/request_upload_url/",
                           {"content_type": "application/pdf"}, format="json")
        # Private resource is invisible → 404; even if it were institution-
        # visible only the owner/admin can get a presign.
        assert resp.status_code in (403, 404)

    def test_bookmark_rejects_private_resource_of_other_user(self):
        tenant = Tenant.objects.create(name="T", slug="t")
        alice = _make_student(tenant, "a@t.edu")
        bob = _make_student(tenant, "b@t.edu")
        r = _make_resource(alice, Resource.Visibility.PRIVATE, uploaded_by=alice)

        client = APIClient()
        token = _login(client, bob)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        resp = client.post("/api/v1/bookmarks/", {"resource": str(r.id)}, format="json")
        assert resp.status_code == 400, resp.data

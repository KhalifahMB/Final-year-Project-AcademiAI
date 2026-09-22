"""
Tenant-context middleware tests.

Regression coverage for the cookie-transport gap: the SPA authenticates with an
httpOnly ``access_token`` cookie and never sends an Authorization header or a
Django session, so the middleware must resolve the user from the cookie to bind
``app.current_tenant_id``. Without it, RLS hides every row for browser traffic.
"""
import pytest
from django.test import RequestFactory
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.common.middleware import TenantContextMiddleware
from apps.tenants.models import Tenant


def _access_cookie(user):
    return {"access_token": str(RefreshToken.for_user(user).access_token)}


@pytest.mark.django_db
def test_middleware_binds_tenant_from_access_cookie():
    tenant = Tenant.objects.create(name="Cookie Tenant", slug="cookie-tenant")
    user = User.objects.create_user(
        email="cookie@example.com", password="pw12345!", tenant=tenant
    )

    request = RequestFactory().get("/api/v1/anything/")
    request.COOKIES.update(_access_cookie(user))

    seen = {}

    def view(req):
        seen["tenant_id"] = req.tenant_id
        seen["tenant"] = req.tenant
        # The session GUC must be bound for the life of the request so RLS
        # policies on tenant-scoped tables resolve correctly.
        from django.db import connection

        with connection.cursor() as cur:
            cur.execute("SELECT current_setting('app.current_tenant_id', true)")
            seen["guc"] = cur.fetchone()[0]
        from django.http import HttpResponse

        return HttpResponse("ok")

    TenantContextMiddleware(view)(request)

    assert seen["tenant_id"] == str(tenant.id)
    assert seen["tenant"] == tenant
    assert seen["guc"] == str(tenant.id)


@pytest.mark.django_db
def test_middleware_leaves_tenant_unbound_without_credentials():
    request = RequestFactory().get("/api/v1/public/")

    seen = {}

    def view(req):
        seen["tenant_id"] = req.tenant_id
        from django.http import HttpResponse

        return HttpResponse("ok")

    TenantContextMiddleware(view)(request)

    assert seen["tenant_id"] is None


@pytest.mark.django_db
def test_middleware_ignores_invalid_access_cookie():
    request = RequestFactory().get("/api/v1/anything/")
    request.COOKIES["access_token"] = "not-a-real-token"

    seen = {}

    def view(req):
        seen["tenant_id"] = req.tenant_id
        from django.http import HttpResponse

        return HttpResponse("ok")

    TenantContextMiddleware(view)(request)

    assert seen["tenant_id"] is None

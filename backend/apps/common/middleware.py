"""
Tenant context middleware.

Derives tenant from authenticated membership; never trusts client-supplied
tenant identifiers.

Why session-local (not transaction-local) config:

Previous versions wrapped the whole request in `transaction.atomic()` and
set `app.current_tenant_id` with set_config(..., is_local=true), which is
transaction-scoped. That worked fine for regular views, but for
StreamingHttpResponse Django returns from the atomic block *before*
iterating the response body — so any DB writes the generator performed
ran without tenant context and tripped RLS (e.g. "new row violates
row-level security policy for table chat_messages").

The fix is to set the GUC with `is_local=false` (session lifetime),
execute the view WITHOUT a forced wrapping transaction, and always reset
the setting in a `finally` block so pooled connections are clean.
Per-request code that needs its own atomic block (most services and the
`tenant_scope()` helper) still works because nested transactions do not
clear session GUCs.
"""
import logging

from django.db import connection

logger = logging.getLogger(__name__)


def _user_from_bearer_token(request):
    """Resolve the user from an Authorization: Bearer <access> header."""
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication

        validated = JWTAuthentication().get_validated_token(auth[len("Bearer "):].strip())
        return JWTAuthentication().get_user(validated)
    except Exception:
        # Invalid/expired tokens are handled (401) by DRF authentication;
        # here we simply have no tenant context.
        return None


def _resolve_request_user(request):
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return _user_from_bearer_token(request)


class TenantContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = None
        request.tenant_id = None

        user = _resolve_request_user(request)
        tenant = getattr(user, "tenant", None) if user is not None else None

        if tenant is None:
            return self.get_response(request)

        request.tenant = tenant
        request.tenant_id = str(tenant.id)
        tid = str(tenant.id)

        # Bind tenant for the whole request (connection/session scope),
        # then always reset so the connection is clean when returned to
        # the pool.
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('app.current_tenant_id', %s, false)",
                [tid],
            )
        try:
            return self.get_response(request)
        finally:
            try:
                with connection.cursor() as cursor:
                    cursor.execute("RESET app.current_tenant_id")
            except Exception:
                # If the connection is already broken we don't want to
                # mask the original exception.
                logger.debug("Failed to reset tenant config on connection")

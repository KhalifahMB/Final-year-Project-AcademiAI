"""
Tenant context middleware.

Derives tenant from authenticated membership; never trusts client-supplied
tenant identifiers.

Important ordering detail: DRF performs JWT authentication *inside the view*,
so Django's AuthenticationMiddleware has not resolved token-authenticated
users yet when this middleware runs. To make Row-Level Security work for JWT
requests, this middleware additionally validates the Bearer token (signature
and expiry, via SimpleJWT) and loads the user, then binds the whole request
to one transaction whose local `app.current_tenant_id` setting scopes every
ORM query to the tenant. The setting disappears automatically when the
transaction ends, so it cannot leak between requests.
"""
import logging

from django.db import transaction

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
        if tenant is not None:
            request.tenant = tenant
            request.tenant_id = str(tenant.id)
            try:
                with transaction.atomic():
                    with transaction.get_connection().cursor() as cursor:
                        cursor.execute(
                            "SELECT set_config('app.current_tenant_id', %s, true)",
                            [str(tenant.id)],
                        )
                    return self.get_response(request)
            except Exception:
                logger.exception("Failed to establish tenant DB context")
                raise

        return self.get_response(request)

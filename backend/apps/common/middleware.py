"""
Tenant context middleware.
Derives tenant from authenticated membership; never trusts client-supplied tenant_id alone.
"""
import logging

logger = logging.getLogger(__name__)


class TenantContextMiddleware:
    """
    Attaches request.tenant when the user is authenticated and has an active membership.
    RLS policies (when enabled) can read the tenant from a session variable set here.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = None
        request.tenant_id = None

        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            # Prefer explicit membership relation if present
            tenant = getattr(user, "tenant", None)
            if tenant is not None:
                request.tenant = tenant
                request.tenant_id = str(tenant.id)
                # Set PostgreSQL session variable for RLS (safe no-op if RLS not yet applied)
                try:
                    from django.db import connection
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "SELECT set_config('app.current_tenant_id', %s, true)",
                            [str(tenant.id)],
                        )
                except Exception as exc:  # pragma: no cover
                    logger.debug("Could not set tenant GUC: %s", exc)

        response = self.get_response(request)
        return response

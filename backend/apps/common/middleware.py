"""
Tenant context middleware.

Derives tenant from authenticated membership; never trusts client-supplied
tenant identifiers. The RLS tenant GUC is transaction-local, so the entire
request is wrapped in one transaction while the GUC is set — this guarantees
every ORM query in the request executes under the correct RLS context and
that the setting is reset when the request ends.
"""
import logging

from django.db import transaction

logger = logging.getLogger(__name__)


class TenantContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.tenant = None
        request.tenant_id = None

        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            tenant = getattr(user, "tenant", None)
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

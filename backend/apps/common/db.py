"""
Database tenant-context utilities.

PostgreSQL RLS policies read app.current_tenant_id via current_setting().
The setting is transaction-local (set_config ..., true) so it can never leak
into a later request/task reusing the connection. Any unit of work that touches
tenant-scoped tables must therefore run inside tenant_scope(tenant_id).
"""

# Scope contract
# -----------------
# * Requests: the tenant-binding middleware (apps/common/middleware.py) sets
#   ``app.current_tenant_id`` at CONNECTION/SESSION scope for the life of the
#   request and resets it afterwards. Request code must NOT call tenant_scope()
#   — it is redundant (and nests a transaction without need).
# * Celery tasks / async / management commands: no middleware runs. These MUST
#   open ``with tenant_scope(tenant_id):`` around any tenant-scoped ORM access,
#   or RLS will reject every query with a ``policy_expr_filter`` violation.
#
# Rule of thumb: if you are NOT inside an HTTP request, wrap in tenant_scope().
# During code review, every Celery task that touches tenant-scoped models gets
# flagged until it proves its writes/reads are inside tenant_scope().

from contextlib import contextmanager

from django.db import connection, transaction


@contextmanager
def tenant_scope(tenant_id):
    """
    Open a transaction and bind it to the given tenant for RLS.

    Celery/async-only. Runs ``set_config(..., is_local=True)`` so the tenant
    binding lives inside this transaction and is reset on exit — it can never
    leak into a later task on the same pooled connection.

    Usage:
        with tenant_scope(resource.tenant_id):
            ...ORM writes/reads...
    """
    if not tenant_id:
        raise ValueError("tenant_scope requires a non-empty tenant_id")
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('app.current_tenant_id', %s, true)",
                [str(tenant_id)],
            )
        yield

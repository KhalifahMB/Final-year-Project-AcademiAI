"""
Database tenant-context utilities.

PostgreSQL RLS policies read app.current_tenant_id via current_setting().
The setting is transaction-local (set_config ..., true) so it can never leak
into a later request/task reusing the connection. Any unit of work that touches
tenant-scoped tables must therefore run inside tenant_scope(tenant_id).
"""
from contextlib import contextmanager

from django.db import connection, transaction


@contextmanager
def tenant_scope(tenant_id):
    """
    Open a transaction and bind it to the given tenant for RLS.

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

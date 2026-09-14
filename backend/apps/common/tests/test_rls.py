"""
Database-level RLS tests: prove PostgreSQL Row-Level Security denies
cross-tenant access even for direct ORM/raw queries.

Key: Django's normal test DB role is a SUPERUSER which has BYPASSRLS by
default, so RLS policies never fire. We SET ROLE to a dedicated
NOBYPASSRLS role for the test body so policies actually apply.

The table list is NOT maintained here — it comes from the single source of
truth ``apps.common.rls.TABLES`` (derived from the model registry), so adding
a tenant-scoped model automatically extends both the policies and this test.
"""
import pytest
from contextlib import contextmanager
from django.db import connection

from apps.academics.models import Faculty
from apps.tenants.models import Tenant
from apps.common.rls import TABLES as RLS_TABLES

RLS_ROLE = "rls_tester"


def test_rls_table_list_is_derived():
    """RLS coverage must come from the model registry, never a hand list.

    Every tenant-scoped model (TenantScopedModel subclass, or any other table
    with a tenant_id column) must appear in TABLES; the only tenant-bearing
    tables exempt from RLS are the platform identity tables.
    """
    from django.apps import apps as django_apps

    from apps.common.models import TenantScopedModel
    from apps.common import rls

    assert rls.TABLES == rls.derive_tenant_scoped_tables()

    for model in django_apps.get_models():
        if model._meta.abstract or not model._meta.managed:
            continue
        label = f"{model._meta.app_label}.{model._meta.model_name}"
        tenant_bearing = any(f.attname == "tenant_id" for f in model._meta.fields)
        if issubclass(model, TenantScopedModel) or tenant_bearing:
            if label in rls.EXEMPT_TENANT_BEARING_MODELS:
                continue
            assert model._meta.db_table in rls.TABLES, (
                f"{label} is tenant-scoped but missing from RLS policy tables"
            )

    # Deliberate exemptions are exactly the two platform identity tables.
    assert rls.EXEMPT_TENANT_BEARING_MODELS == {"accounts.user", "tenants.tenant"}


@contextmanager
def _as_superuser():
    """Temporarily elevate back to the superuser role for setup/teardown."""
    with connection.cursor() as cursor:
        cursor.execute("SET ROLE NONE")
        try:
            yield
        finally:
            cursor.execute(f'SET ROLE "{RLS_ROLE}"')


@pytest.fixture(scope="function")
def rls_enabled(transactional_db):
    """Enable FORCE RLS + tenant policy on all tenant-scoped tables,
    and switch the connection to a NOBYPASSRLS role so policies actually
    fire (Postgres superusers have BYPASSRLS and skip RLS entirely)."""
    with connection.cursor() as cursor:
        # Create the tester role (idempotent). Must be done as superuser.
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [RLS_ROLE])
        row = cursor.fetchone()
        exists = bool(row and row[0])
        if not exists:
            cursor.execute(
                f'CREATE ROLE "{RLS_ROLE}" NOINHERIT LOGIN NOBYPASSRLS PASSWORD %s',
                [RLS_ROLE],
            )
        # Grant same privileges the app role has so the tester can read/write.
        cursor.execute(f'GRANT academiai_app TO "{RLS_ROLE}"')
        cursor.execute(f'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "{RLS_ROLE}"')
        cursor.execute(f'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "{RLS_ROLE}"')
        cursor.execute(f'GRANT ALL ON SCHEMA public TO "{RLS_ROLE}"')

        # Apply RLS policies (as superuser).
        for table in RLS_TABLES:
            cursor.execute(f"ALTER TABLE IF EXISTS {table} ENABLE ROW LEVEL SECURITY")
            cursor.execute(f"ALTER TABLE IF EXISTS {table} FORCE ROW LEVEL SECURITY")
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
            cursor.execute(
                f"CREATE POLICY tenant_isolation ON {table} "
                f"FOR ALL "
                f"USING (tenant_id::text = current_setting('app.current_tenant_id', true)) "
                f"WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true))"
            )

        # Switch to the unprivileged (NOBYPASSRLS) role for the test body.
        cursor.execute(f'SET ROLE "{RLS_ROLE}"')

    yield _as_superuser

    with connection.cursor() as cursor:
        cursor.execute("RESET ROLE")
        for table in RLS_TABLES:
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
            cursor.execute(f"ALTER TABLE IF EXISTS {table} DISABLE ROW LEVEL SECURITY")
        try:
            # Reassign ownership before dropping the temporary role. In the
            # ephemeral pytest databases used by xdist, some objects may still
            # be attached to this role when teardown runs. Treat this as a
            # best-effort cleanup because the per-worker test DB is discarded.
            cursor.execute(f'REASSIGN OWNED BY "{RLS_ROLE}" TO CURRENT_USER')
            cursor.execute(f'DROP OWNED BY "{RLS_ROLE}"')
            cursor.execute(f'DROP ROLE IF EXISTS "{RLS_ROLE}"')
        except Exception:
            pass


def _set_tenant(tenant_id):
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT set_config('app.current_tenant_id', %s, false)", [str(tenant_id)]
        )


def _clear_tenant():
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.current_tenant_id', '', false)")


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_cross_tenant_reads(rls_enabled):
    as_superuser = rls_enabled
    with as_superuser():
        ta = Tenant.objects.create(name="A", slug="a-rls")
        tb = Tenant.objects.create(name="B", slug="b-rls")

    _set_tenant(ta.id)
    with as_superuser():
        faculty_a = Faculty.objects.create(tenant=ta, name="Fac A", code="FA")
    assert faculty_a is not None

    _set_tenant(tb.id)
    with as_superuser():
        Faculty.objects.create(tenant=tb, name="Fac B", code="FB")

    _set_tenant(ta.id)
    visible_a = set(Faculty.objects.values_list("code", flat=True))
    assert visible_a == {"FA"}

    _set_tenant(tb.id)
    visible_b = set(Faculty.objects.values_list("code", flat=True))
    assert visible_b == {"FB"}

    _clear_tenant()
    assert Faculty.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_insert_without_tenant_context(rls_enabled):
    as_superuser = rls_enabled
    with as_superuser():
        ta = Tenant.objects.create(name="A2", slug="a2-rls")
    _clear_tenant()
    from django.db.utils import IntegrityError, ProgrammingError

    with pytest.raises((IntegrityError, ProgrammingError)):
        Faculty.objects.create(tenant=ta, name="NoCtx", code="NC")


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_cross_tenant_updates(rls_enabled):
    as_superuser = rls_enabled
    with as_superuser():
        ta = Tenant.objects.create(name="A3", slug="a3-rls")
        tb = Tenant.objects.create(name="B3", slug="b3-rls")

    _set_tenant(tb.id)
    with as_superuser():
        Faculty.objects.create(tenant=tb, name="Fac B3", code="FB3")

    _set_tenant(ta.id)
    updated = Faculty.objects.filter(code="FB3").update(name="Hacked")
    assert updated == 0

    _set_tenant(tb.id)
    assert Faculty.objects.get(code="FB3").name == "Fac B3"

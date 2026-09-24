"""
Database-level RLS tests: prove PostgreSQL Row-Level Security denies
cross-tenant access even for direct ORM/raw queries.

The rest of the suite connects as `academiai_test`, which has BYPASSRLS so the
~280 tenant-scoped writes that have not been converted to tenant_scope() keep
working. Nothing in this file runs under that bypass: `rls_enforced` does
`SET ROLE academiai` — the role that owns the schema and serves production
traffic — and every assertion below is made through it. Membership in
`academiai` is granted once by the remediation plan (Task 3), so no CREATEROLE
is needed here, and `test_suite_connection_bypasses_rls` records the gap this
file deliberately does not paper over.

Why that role and not another: `academiai` owns the tables, and a table owner
is exempt from its own policies unless the table FORCES them
(`apps/common/rls.py:81-84`). Testing any other identity would test a posture
the application never runs in.

Policies are already enabled and FORCE'd by the migration graph
(`apps/common/migrations/0001_rls_tenant_isolation.py` plus the `post_migrate`
receiver in `apps/common/apps.py`); the posture guard below checks that and
says so, instead of quietly re-creating what it is supposed to verify.

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

RUNTIME_ROLE = "academiai"


def _rows(sql, params=None):
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        return list(cursor.fetchall())


def _scalar(sql, params=None):
    rows = _rows(sql, params)
    return rows[0][0] if rows and rows[0] else None


def _set_tenant(tenant_id):
    _scalar("SELECT set_config('app.current_tenant_id', %s, false)", [str(tenant_id)])


def _clear_tenant():
    _scalar("SELECT set_config('app.current_tenant_id', '', false)")


def test_rls_table_list_is_derived():
    """RLS coverage must come from the model registry, never a hand list.

    Every tenant-scoped model (TenantScopedModel subclass, or any other table
    with a tenant_id column) must appear in TABLES; the only tenant-bearing
    exemptions are the two platform identity tables.
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


@pytest.mark.django_db
def test_runtime_role_is_demoted():
    """The role real traffic uses must not be able to skip RLS.

    Cluster-wide catalog state, so it holds in a test database as much as in
    the developer's. If this fails, someone ran
    `ALTER ROLE academiai SUPERUSER` and every isolation guarantee is fiction.
    """
    flags = _rows(
        "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = %s",
        [RUNTIME_ROLE],
    )
    assert flags, f"role {RUNTIME_ROLE} does not exist"
    assert not flags[0][0], "the runtime role is a superuser, which bypasses RLS"
    assert not flags[0][1], "the runtime role has BYPASSRLS"


@pytest.mark.django_db
def test_suite_connection_bypasses_rls():
    """Tripwire for the shim in conftest.py, not an assertion of intent.

    The suite runs as a BYPASSRLS role because 31 files still write
    tenant-scoped rows outside tenant_scope(). When that conversion lands, this
    test fails — and the fix is to delete it and the conftest hook, not to make
    it pass some other way.
    """
    assert _scalar("SELECT current_user") != RUNTIME_ROLE
    assert _scalar(
        "SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user"
    ), "the test connection no longer bypasses RLS: the conversion is done"


def _posture_problems():
    """Return reasons RLS is not genuinely configured in this database."""
    problems = []
    if _scalar("SELECT rolsuper FROM pg_roles WHERE rolname = %s", [RUNTIME_ROLE]):
        problems.append(f"{RUNTIME_ROLE} is a superuser and would skip every policy")
    if _scalar("SELECT rolbypassrls FROM pg_roles WHERE rolname = %s", [RUNTIME_ROLE]):
        problems.append(f"{RUNTIME_ROLE} has BYPASSRLS and would skip every policy")

    state = {
        row[0]: (row[1], row[2])
        for row in _rows(
            "SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity "
            "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r'"
        )
    }
    # A table with RLS enabled but no policy is not filtered, it is simply
    # empty for everyone — a confusing way to pass an isolation test.
    policed = {
        row[0]
        for row in _rows(
            "SELECT tablename FROM pg_policies WHERE schemaname = 'public' "
            "AND policyname = 'tenant_isolation'"
        )
    }
    missing = [t for t in RLS_TABLES if t not in state]
    if missing:
        problems.append(f"tenant-scoped tables absent from the schema: {sorted(missing)}")
    unforced = [t for t in RLS_TABLES if t in state and not all(state[t])]
    if unforced:
        problems.append(
            "tables without RLS ENABLED + FORCED (an owner bypasses a policy it "
            f"does not force): {sorted(unforced)}"
        )
    unpolicied = [t for t in RLS_TABLES if t in state and t not in policed]
    if unpolicied:
        problems.append(f"tables with no tenant_isolation policy: {sorted(unpolicied)}")
    return problems


@contextmanager
def _as_runtime_role():
    with connection.cursor() as cursor:
        cursor.execute(f'SET ROLE "{RUNTIME_ROLE}"')
        try:
            yield
        finally:
            cursor.execute("RESET ROLE")


@pytest.fixture
def rls_enforced(transactional_db):
    """Configure the session to act as the runtime role, then hand it over.

    Two things the test database needs that production already has: the
    privileges (this database's objects belong to `academiai_test`, which built
    them) and the demoted posture (asserted before switching, so a
    re-elevated `academiai` fails loudly here rather than passing vacuously).
    The GUC is cleared on teardown because it is session-scoped; the role
    context manager resets itself.
    """
    with connection.cursor() as cursor:
        cursor.execute(f'GRANT USAGE ON SCHEMA public TO "{RUNTIME_ROLE}"')
        cursor.execute(
            f'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "{RUNTIME_ROLE}"'
        )
        cursor.execute(
            f'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "{RUNTIME_ROLE}"'
        )

    problems = _posture_problems()
    assert not problems, "RLS is not enforced for the runtime role:\n- " + "\n- ".join(problems)

    with _as_runtime_role():
        yield
    _clear_tenant()


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_cross_tenant_reads(rls_enforced):
    ta = Tenant.objects.create(name="A", slug="a-rls")
    tb = Tenant.objects.create(name="B", slug="b-rls")

    _set_tenant(ta.id)
    Faculty.objects.create(tenant=ta, name="Fac A", code="FA")
    _set_tenant(tb.id)
    Faculty.objects.create(tenant=tb, name="Fac B", code="FB")

    _set_tenant(ta.id)
    assert set(Faculty.objects.values_list("code", flat=True)) == {"FA"}

    _set_tenant(tb.id)
    assert set(Faculty.objects.values_list("code", flat=True)) == {"FB"}

    _clear_tenant()
    assert Faculty.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_insert_without_tenant_context(rls_enforced):
    from django.db.utils import IntegrityError, ProgrammingError

    ta = Tenant.objects.create(name="A2", slug="a2-rls")
    _clear_tenant()
    with pytest.raises((IntegrityError, ProgrammingError)):
        Faculty.objects.create(tenant=ta, name="NoCtx", code="NC")


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_cross_tenant_updates(rls_enforced):
    ta = Tenant.objects.create(name="A3", slug="a3-rls")
    tb = Tenant.objects.create(name="B3", slug="b3-rls")

    _set_tenant(tb.id)
    Faculty.objects.create(tenant=tb, name="Fac B3", code="FB3")

    _set_tenant(ta.id)
    assert Faculty.objects.filter(code="FB3").update(name="Hacked") == 0

    _set_tenant(tb.id)
    assert Faculty.objects.get(code="FB3").name == "Fac B3"

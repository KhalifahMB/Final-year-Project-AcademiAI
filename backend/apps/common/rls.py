"""
Canonical PostgreSQL Row-Level Security configuration for all tenant-scoped
tables.

Single source of truth for the table list and policy DDL, shared by:

- the migration `apps/common/migrations/0001_rls_tenant_isolation.py`
  (automatic enforcement on every `migrate`/deploy), and
- the management command `apps/common/management/commands/apply_rls.py`
  (manual re-application — run it again whenever you add a tenant-scoped model).

The table list is DERIVED from the model registry at import time rather than
maintained by hand:

- every concrete model that inherits ``TenantScopedModel``, plus
- any other managed model with a ``tenant_id`` column, minus a small explicit
  exemption set (``accounts_user`` and ``tenants_tenant``), which are
  platform-identity tables deliberately outside RLS so unauthenticated auth
  lookups still work.

Adding a tenant-scoped model anywhere therefore requires no edits here, in
`sql/rls_policies.sql`, or in the tests — they all read this derivation.

Ordering caveat: the auto-applying migration 0001 runs mid-graph, so tables
created by migrations later in the graph don't exist yet at that point. Every
statement below is guarded by ``to_regclass`` and therefore simply skips
missing tables; the tables are picked up for real by `apply_rls`, which the
deploy pipeline runs after `migrate` and which re-derives the list from the
fully-migrated registry.

DDL is generated here in Python as guarded DO blocks (single statements each)
rather than raw ``%I``-formatted ``CREATE POLICY`` calls, because Django
executes migrations through psycopg's client-side binding which misinterprets
``%`` directives. The SQL file remains a human-readable spec; its own list is
discovered from information_schema so it can never drift either.
"""

from apps.common.models import TenantScopedModel

# Tenant-bearing tables that must NOT get RLS:
# - accounts.user      — the auth identity model. Sign-in, password reset, and
#   cross-tenant admin lookups must explode the whole user table; an RLS policy
#   would break unauthenticated (tenantless) auth flows.
# - tenants.tenant     — the tenant model itself; it has no tenant_id column,
#   but keeping it here documents the intent if that ever changes.
EXEMPT_TENANT_BEARING_MODELS = {
    "accounts.user",
    "tenants.tenant",
}


def derive_tenant_scoped_tables():
    """All tables protected by RLS, derived from the live model registry."""
    from django.apps import apps as django_apps

    tables = set()
    for model in django_apps.get_models():
        if model._meta.abstract or not model._meta.managed:
            continue
        label = f"{model._meta.app_label}.{model._meta.model_name}"
        has_tenant_id = any(f.attname == "tenant_id" for f in model._meta.fields)
        if has_tenant_id and label in EXEMPT_TENANT_BEARING_MODELS:
            has_tenant_id = False
        if issubclass(model, TenantScopedModel) or has_tenant_id:
            tables.add(model._meta.db_table)
    return sorted(tables)


TABLES = derive_tenant_scoped_tables()


def policy_statements(table, *, teardown=False):
    """Return the list of SQL statements to apply (or remove) the tenant
    policy on a single table.

    Every statement is idempotent and tolerant of tables that do not exist
    yet during the mid-graph migration run (they get covered by `apply_rls`
    once the full schema exists).
    """
    quoted = '"' + table + '"'
    if not teardown:
        return [(
            "DO $$ BEGIN "
            f"IF to_regclass('public.{table}') IS NOT NULL THEN "
            f"ALTER TABLE {quoted} ENABLE ROW LEVEL SECURITY; "
            f"ALTER TABLE {quoted} FORCE ROW LEVEL SECURITY; "
            f"DROP POLICY IF EXISTS tenant_isolation ON {quoted}; "
            f"CREATE POLICY tenant_isolation ON {quoted} FOR ALL "
            f"USING (tenant_id::text = current_setting('app.current_tenant_id', true)) "
            f"WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true)); "
            "END IF; "
            "END $$;"
        )]
    return [
        f'DROP POLICY IF EXISTS tenant_isolation ON "{table}"',
        f'ALTER TABLE IF EXISTS "{table}" DISABLE ROW LEVEL SECURITY',
    ]


def all_policy_statements(teardown=False):
    """All statements for every tenant-scoped table, in apply/reverse order."""
    stmts = []
    for table in TABLES:
        stmts.extend(policy_statements(table, teardown=teardown))
    return stmts

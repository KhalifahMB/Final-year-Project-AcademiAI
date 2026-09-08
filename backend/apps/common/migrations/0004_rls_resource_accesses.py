"""
Apply RLS to the `resource_accesses` table (added to apps.common.rls.TABLES).

Re-running the full policy set is idempotent (policies are DROP-then-CREATE),
so this simply re-applies RLS to every tenant-scoped table including the new
`resource_accesses` one. Running after `resources.0004_resource_access`
guarantees the table exists before we ALTER it.
"""
from django.db import migrations

from apps.common import rls


def apply_rls(apps, schema_editor):
    for stmt in rls.all_policy_statements(teardown=False):
        schema_editor.execute(stmt)


def reverse_rls(apps, schema_editor):
    for stmt in rls.all_policy_statements(teardown=True):
        schema_editor.execute(stmt)


class Migration(migrations.Migration):
    dependencies = [
        ("resources", "0004_resourceaccess"),
        ("common", "0003_rls_notifications"),
    ]

    operations = [
        migrations.RunPython(apply_rls, reverse_rls),
    ]
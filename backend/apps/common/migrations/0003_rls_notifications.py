"""
Apply RLS to the `notifications` table (added to apps.common.rls.TABLES).

Re-running the full policy set is idempotent (policies are DROP-then-CREATE),
so this simply re-applies RLS to every tenant-scoped table including the new
`notifications` one. Running after `notifications.0001_initial` guarantees the
table exists before we ALTER it.
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
        ("notifications", "0001_initial"),
        ("common", "0002_rls_tenant_logs"),
    ]

    operations = [
        migrations.RunPython(apply_rls, reverse_rls),
    ]
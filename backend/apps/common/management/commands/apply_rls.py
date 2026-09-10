from django.core.management.base import BaseCommand
from django.db import connection

from apps.common import rls


class Command(BaseCommand):
    help = (
        "Apply PostgreSQL RLS policies to every tenant-scoped table "
        "(also applied automatically by the 0001_rls_tenant_isolation migration). "
        "The table list is derived from the model registry at runtime, so re-run "
        "this after adding any new tenant-scoped model."
    )

    def handle(self, *args, **options):
        count = 0
        with connection.cursor() as cursor:
            for stmt in rls.all_policy_statements(teardown=False):
                cursor.execute(stmt)
                count += 1
        self.stdout.write(
            self.style.SUCCESS(f"Applied RLS to {len(rls.TABLES)} tables ({count} statements).")
        )

from django.core.management.base import BaseCommand
from django.db import connection

from apps.common import rls


class Command(BaseCommand):
    help = (
        "Apply PostgreSQL RLS policies to all tenant-scoped tables "
        "(also applied automatically by the 0001_rls_tenant_isolation migration)."
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

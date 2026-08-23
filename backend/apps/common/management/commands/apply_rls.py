from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Apply PostgreSQL RLS policies from apps/common/sql/rls_policies.sql"

    def handle(self, *args, **options):
        sql_path = Path(__file__).resolve().parents[2] / "sql" / "rls_policies.sql"
        sql = sql_path.read_text()
        with connection.cursor() as cursor:
            cursor.execute(sql)
        self.stdout.write(self.style.SUCCESS(f"Applied RLS from {sql_path}"))

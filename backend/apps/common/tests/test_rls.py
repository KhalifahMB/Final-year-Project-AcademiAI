"""
Database-level RLS tests: prove PostgreSQL Row-Level Security denies
cross-tenant access even for direct ORM/raw queries.

These tests apply the same policies as `manage.py apply_rls` to the test DB.
"""
import pytest
from django.db import connection

from apps.academics.models import Faculty
from apps.tenants.models import Tenant

RLS_TABLES = [
    "faculties", "departments", "programmes", "academic_sessions", "semesters",
    "courses", "course_offerings", "lecturer_course_assignments", "course_enrollments",
    "student_profiles", "lecturer_profiles",
    "resources", "resource_versions", "resource_chunks", "resource_permissions",
    "concepts", "concept_edges",
    "chat_sessions", "chat_messages", "chat_message_sources",
    "quizzes", "quiz_questions", "quiz_attempts",
    "notes", "bookmarks", "progress_records",
    "audit_logs",
]


@pytest.fixture(scope="function")
def rls_enabled(transactional_db):
    """Enable FORCE RLS + tenant policy on all tenant-scoped tables."""
    with connection.cursor() as cursor:
        for table in RLS_TABLES:
            cursor.execute(f"ALTER TABLE IF EXISTS {table} ENABLE ROW LEVEL SECURITY")
            cursor.execute(f"ALTER TABLE IF EXISTS {table} FORCE ROW LEVEL SECURITY")
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
            cursor.execute(
                f"CREATE POLICY tenant_isolation ON {table} "
                f"USING (tenant_id::text = current_setting('app.current_tenant_id', true))"
            )
    yield
    with connection.cursor() as cursor:
        for table in RLS_TABLES:
            cursor.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
            cursor.execute(f"ALTER TABLE IF EXISTS {table} DISABLE ROW LEVEL SECURITY")


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
    ta = Tenant.objects.create(name="A", slug="a-rls")
    tb = Tenant.objects.create(name="B", slug="b-rls")

    # Seed rows with GUC bound to each tenant (inserts require matching GUC).
    _set_tenant(ta.id)
    faculty_a = Faculty.objects.create(tenant=ta, name="Fac A", code="FA")

    _set_tenant(tb.id)
    Faculty.objects.create(tenant=tb, name="Fac B", code="FB")

    # Bound to tenant A: only A's rows are visible.
    _set_tenant(ta.id)
    visible_a = set(Faculty.objects.values_list("code", flat=True))
    assert visible_a == {"FA"}

    # Bound to tenant B: only B's rows are visible — cross-tenant read denied.
    _set_tenant(tb.id)
    visible_b = set(Faculty.objects.values_list("code", flat=True))
    assert visible_b == {"FB"}

    # No tenant context: nothing is visible.
    _clear_tenant()
    assert Faculty.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_insert_without_tenant_context(rls_enabled):
    ta = Tenant.objects.create(name="A2", slug="a2-rls")
    _clear_tenant()
    from django.db.utils import IntegrityError, ProgrammingError

    # RLS rejects the INSERT ("new row violates row-level security policy").
    # Depending on driver mapping this surfaces as ProgrammingError
    # (42501) or IntegrityError.
    with pytest.raises((IntegrityError, ProgrammingError)):
        Faculty.objects.create(tenant=ta, name="NoCtx", code="NC")


@pytest.mark.django_db(transaction=True)
def test_rls_blocks_cross_tenant_updates(rls_enabled):
    ta = Tenant.objects.create(name="A3", slug="a3-rls")
    tb = Tenant.objects.create(name="B3", slug="b3-rls")

    _set_tenant(tb.id)
    Faculty.objects.create(tenant=tb, name="Fac B3", code="FB3")

    # Bound to tenant A, an UPDATE against B's row affects nothing.
    _set_tenant(ta.id)
    updated = Faculty.objects.filter(code="FB3").update(name="Hacked")
    assert updated == 0

    _set_tenant(tb.id)
    assert Faculty.objects.get(code="FB3").name == "Fac B3"

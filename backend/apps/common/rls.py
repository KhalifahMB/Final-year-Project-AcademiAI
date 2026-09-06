"""
Canonical PostgreSQL Row-Level Security configuration for all tenant-scoped
tables.

Single source of truth for the table list and policy DDL, shared by:

- the migration `apps/common/migrations/0001_rls_tenant_isolation.py`
  (automatic enforcement on every `migrate`/deploy), and
- the management command `apps/common/management/commands/apply_rls.py`
  (manual re-application).

DDL is generated here in Python (statement-by-statement, no `%` placeholders)
rather than relying on the DO-block form in `sql/rls_policies.sql`, because
Django executes migrations through psycopg's client-side binding which rejects
the `%I` format specifiers used by `EXECUTE format(...)`. Keep this list in
sync with `apps/common/sql/rls_policies.sql` and
`apps/common/tests/test_rls.py::RLS_TABLES`.
"""

TABLES = [
    "faculties", "departments", "programmes", "academic_sessions", "semesters",
    "courses", "course_offerings", "lecturer_course_assignments", "course_enrollments",
    "student_profiles", "lecturer_profiles",
    "resources", "resource_versions", "resource_chunks", "resource_permissions", "resource_summaries",
    "concepts", "concept_edges",
    "chat_sessions", "chat_messages", "chat_message_sources",
    "quizzes", "quiz_questions", "quiz_attempts",
    "notes", "bookmarks", "progress_records",
    "audit_logs",
    "tenant_logs",
]


def policy_statements(table, *, teardown=False):
    """Return the list of SQL statements to apply (or remove) the tenant
    policy on a single table."""
    if teardown:
        return [
            f'DROP POLICY IF EXISTS tenant_isolation ON "{table}"',
            f'ALTER TABLE IF EXISTS "{table}" DISABLE ROW LEVEL SECURITY',
        ]
    return [
        f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY',
        f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY',
        f'DROP POLICY IF EXISTS tenant_isolation ON "{table}"',
        f'CREATE POLICY tenant_isolation ON "{table}" FOR ALL '
        f"USING (tenant_id::text = current_setting('app.current_tenant_id', true)) "
        f"WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true))",
    ]


def all_policy_statements(teardown=False):
    """All statements for every tenant-scoped table, in apply/reverse order."""
    stmts = []
    for table in TABLES:
        stmts.extend(policy_statements(table, teardown=teardown))
    return stmts

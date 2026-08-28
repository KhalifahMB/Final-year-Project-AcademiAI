-- AcademiAI PostgreSQL RLS — all tenant-scoped tables
--
-- Binds every row to the current tenant via current_setting('app.current_tenant_id').
-- The setting is placed at SESSION scope by the middleware (is_local=false) so
-- that StreamingHttpResponse generators — which execute AFTER the request
-- transaction has closed — still see the tenant context. Individual helpers
-- (apps.common.db.tenant_scope) open their own atomic blocks and re-set the
-- GUC as a belt-and-braces measure for Celery tasks and streaming generators.
--
-- Policies:
--   USING      → rows visible to SELECT/UPDATE/DELETE must match the tenant
--   WITH CHECK → new rows written by INSERT/UPDATE must match the tenant
-- Without WITH CHECK, INSERTs would be silently rejected because there is
-- no policy permitting them.
--
-- Apply via:  python manage.py dbshell < apps/common/sql/rls_policies.sql
--            (or the apply_rls management command if present).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'faculties','departments','programmes','academic_sessions','semesters',
    'courses','course_offerings','lecturer_course_assignments','course_enrollments',
    'student_profiles','lecturer_profiles',
    'resources','resource_versions','resource_chunks','resource_permissions','resource_summaries',
    'concepts','concept_edges',
    'chat_sessions','chat_messages','chat_message_sources',
    'quizzes','quiz_questions','quiz_attempts',
    'notes','bookmarks','progress_records',
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      '   FOR ALL '
      '   USING (tenant_id::text = current_setting(''app.current_tenant_id'', true)) '
      '   WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

-- Optional: HNSW index for embeddings (run after data exists; adjust lists/m as needed)
-- CREATE INDEX IF NOT EXISTS resource_chunks_embedding_hnsw
--   ON resource_chunks USING hnsw (embedding vector_cosine_ops);

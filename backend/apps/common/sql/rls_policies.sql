-- AcademiAI PostgreSQL RLS — all tenant-scoped tables
-- Requires set_config('app.current_tenant_id', <uuid>, true) from middleware

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'faculties','departments','programmes','academic_sessions','semesters',
    'courses','course_offerings','lecturer_course_assignments','course_enrollments',
    'resources','resource_versions','resource_chunks','resource_permissions',
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
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))',
      t
    );
  END LOOP;
END $$;

-- Optional: HNSW index for embeddings (run after data exists; adjust lists/m as needed)
-- CREATE INDEX IF NOT EXISTS resource_chunks_embedding_hnsw
--   ON resource_chunks USING hnsw (embedding vector_cosine_ops);

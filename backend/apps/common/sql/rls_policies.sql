-- AcademiAI PostgreSQL RLS (apply after migrations; run as migration or ops script)
-- Tenant context is set by TenantContextMiddleware via set_config('app.current_tenant_id', ...)

-- Example for a tenant-scoped table pattern. Repeat for each domain table.

-- faculties
ALTER TABLE faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculties FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_faculties ON faculties;
CREATE POLICY tenant_isolation_faculties ON faculties
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_departments ON departments;
CREATE POLICY tenant_isolation_departments ON departments
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- programmes
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_programmes ON programmes;
CREATE POLICY tenant_isolation_programmes ON programmes
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_courses ON courses;
CREATE POLICY tenant_isolation_courses ON courses
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- course_offerings
ALTER TABLE course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_offerings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_course_offerings ON course_offerings;
CREATE POLICY tenant_isolation_course_offerings ON course_offerings
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- resources
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resources ON resources;
CREATE POLICY tenant_isolation_resources ON resources
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- resource_chunks
ALTER TABLE resource_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_chunks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resource_chunks ON resource_chunks;
CREATE POLICY tenant_isolation_resource_chunks ON resource_chunks
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- chat_sessions / chat_messages
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_chat_sessions ON chat_sessions;
CREATE POLICY tenant_isolation_chat_sessions ON chat_sessions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_chat_messages ON chat_messages;
CREATE POLICY tenant_isolation_chat_messages ON chat_messages
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- quizzes
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_quizzes ON quizzes;
CREATE POLICY tenant_isolation_quizzes ON quizzes
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Note: application role used by Django must NOT be a superuser/bypass RLS role.

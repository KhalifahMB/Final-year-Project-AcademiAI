-- Creates the dev/CI-only test role the backend pytest suite connects as
-- (backend/conftest.py defaults POSTGRES_TEST_USER to `academiai_test`).
-- This role exists ONLY so the test suite can keep running while the ~280
-- unscoped tenant-scoped fixture writes across 31 test files are converted
-- to tenant_scope(). It carries BYPASSRLS — precisely the privilege the rest
-- of this directory is careful NOT to give any role — so it must never appear
-- in a deployment. The follow-up conversion plan deletes both this file and
-- the role; test_suite_connection_bypasses_rls in
-- backend/apps/common/tests/test_rls.py is the tripwire for that day.
-- Runs automatically on first container initialization via
-- /docker-entrypoint-initdb.d, and is idempotent: re-running it against a
-- volume that already has the role reproduces the same posture.
--
-- This script runs as the bootstrap superuser (compose POSTGRES_USER=postgres)
-- and touches no role other than `academiai_test`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'academiai_test') THEN
    -- BYPASSRLS: the deliberate, temporary test-suite shim described above.
    -- CREATEDB is required by pytest-django to create test databases.
    CREATE ROLE academiai_test LOGIN PASSWORD 'academiai_test'
      NOSUPERUSER NOCREATEROLE NOREPLICATION BYPASSRLS CREATEDB;
  ELSE
    -- Defensive: if the role already exists with drifted attributes, pin it
    -- back to the intended posture. No other role is ever touched.
    ALTER ROLE academiai_test
      NOSUPERUSER NOCREATEROLE NOREPLICATION BYPASSRLS LOGIN CREATEDB;
  END IF;
END
$$;

-- Mirrors what 01-app-role.sql does for the app role: pytest-django creates
-- the test databases as this role, so it needs database-level privileges.
GRANT ALL PRIVILEGES ON DATABASE academiai TO academiai_test;

-- SET ROLE academiai in backend/apps/common/tests/test_rls.py depends on this
-- membership (it lets the RLS tests demote to the runtime role without the
-- test role needing CREATEROLE). Guarded via pg_auth_members; note this
-- cluster's columns are `member` and `roleid`, not memberid/grantorid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_auth_members a
      JOIN pg_roles m ON m.oid = a.member
      JOIN pg_roles g ON g.oid = a.roleid
     WHERE m.rolname = 'academiai_test' AND g.rolname = 'academiai'
  ) THEN
    GRANT academiai TO academiai_test;
  END IF;
END
$$;

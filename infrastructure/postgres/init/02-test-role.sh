#!/bin/sh
# Creates the dev/CI-only role the backend pytest suite connects as
# (backend/conftest.py defaults POSTGRES_TEST_USER to `academiai_test`).
#
# Why a gate: docker-compose.yml mounts this entire directory into
# /docker-entrypoint-initdb.d, so every script here runs on the first init of ANY
# volume built from that file - including a deployment, since that compose file is
# the only DB provisioning this repository ships. The role created below carries
# BYPASSRLS, which is precisely the privilege the rest of this directory exists to
# withhold, so it is created only when a developer opts in with
# ACADEMIAI_DEV_TEST_ROLE=1 (see .env.example).
#
# Why the role exists at all: ~280 tenant-scoped fixture writes across 31 test
# files still create rows outside tenant_scope(). The follow-up conversion plan
# wraps them, then deletes this script, the role, and the conftest.py hook. Until
# then the suite would otherwise die on RLS; test_suite_connection_bypasses_rls in
# backend/apps/common/tests/test_rls.py is the tripwire for that day.
#
# It must NEVER appear in a deployment. It touches no role other than
# `academiai_test`, and is idempotent: applying it to a volume that already has the
# role reproduces the same posture.
#
# There is deliberately no early `exit`: the postgres entrypoint sources a
# non-executable .sh rather than running it, and a bind mount from Windows does not
# reliably carry the exec bit, so `exit 0` here could abort the whole init run.
if [ "${ACADEMIAI_DEV_TEST_ROLE:-0}" = "1" ]; then
  echo "Creating the dev-only 'academiai_test' role (BYPASSRLS; development only)."
  # The quoted heredoc delimiter matters: the DO blocks use $$, which an unquoted
  # heredoc would expand as this shell's own PID.
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
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
EOSQL
else
  echo "Skipping the dev-only 'academiai_test' role (set ACADEMIAI_DEV_TEST_ROLE=1 to create it)."
fi

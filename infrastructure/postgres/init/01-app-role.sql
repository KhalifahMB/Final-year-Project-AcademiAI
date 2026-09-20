-- Creates the non-superuser application role used by Django at runtime,
-- for migrations and tests. It must NEVER have BYPASSRLS so that
-- PostgreSQL Row-Level Security is genuinely enforced.
-- Runs automatically on first container initialization via
-- /docker-entrypoint-initdb.d.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'academiai') THEN
    -- CREATEDB is required by pytest-django to create test databases in dev.
    -- Production deployments may revoke CREATEDB.
    CREATE ROLE academiai LOGIN PASSWORD 'academiai'
      NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS CREATEDB;
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE academiai TO academiai;

-- PG15+ revoked world-writability of the public schema; the app role owns it.
GRANT USAGE, CREATE ON SCHEMA public TO academiai;
ALTER SCHEMA public OWNER TO academiai;

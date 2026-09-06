# Multi-Tenancy and PostgreSQL RLS

## Strategy

Shared database + shared schema + `tenant_id` + PostgreSQL Row-Level Security.

## Request flow

1. JWT identifies user.
2. Application resolves tenant membership.
3. Trusted request context establishes tenant ID.
4. Service layer applies tenant-aware querysets.
5. PostgreSQL RLS provides database-level enforcement.
6. Response is returned only after object-level authorization.

## RLS principles

Every tenant-scoped table must have an appropriate RLS policy.

The database role used by the application must not have `BYPASSRLS`.

Where the security model requires policies to apply to the table owner, use `FORCE ROW LEVEL SECURITY`.

## Tenant context

Tenant context must never be accepted solely from an arbitrary client-supplied header. It must be derived from authenticated membership and validated against the user's permitted tenant.

## Cross-tenant relationship integrity

Use composite constraints/foreign keys where practical to ensure related records belong to the same tenant.

## Security tests

At minimum test:
- tenant A cannot read tenant B resources
- tenant A cannot modify tenant B resources
- guessed UUID does not bypass authorization
- altered tenant IDs do not bypass authorization
- user cannot retrieve unauthorized course resources
- role escalation is denied
- RLS denies direct cross-tenant access
- cache keys do not leak data across tenants

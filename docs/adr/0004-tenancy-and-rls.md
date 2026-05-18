# ADR 0004 — Multi-tenancy via Postgres Row-Level Security

- **Status:** Accepted
- **Date:** 2026-04-18

## Context

Phase 1 has a single tenant — SurakshaSaathi's own B2C product. Phase 2+ adds: NGO dashboards (Idea 3), corporate HR tools (Ideas 2, 4), state-government partnerships (Idea 3), broker / advisor franchisees (Ideas 5, 6). Each must be isolated.

The engineering-instructions doc mandates `tenant_id` on every model from Day 1 — "adding this later is a painful and risky migration."

## Decision

- Every business table carries a non-null `tenant_id` FK to `tenant`. Enforced at the DB level, not app level.
- Row-Level Security (RLS) policies restrict every query to the caller's tenant — derived from the JWT `tenant_id` claim issued by Supabase Auth (with our custom claim hook).
- The default B2C tenant has id `'surakshasaathi'` (human-readable slug); every user that signs up via phone-OTP on the consumer apps lands in this tenant.
- A user can belong to multiple tenants via the `membership` table (user × tenant × role). Switching tenant context in the UI switches the JWT tenant_id claim.
- B2B org admins see only their tenant's data.
- The `admin` role (our internal ops team) uses a Supabase service key that bypasses RLS but is logged in `audit_log` for every access.

## Consequences

- One Postgres instance, one schema, many tenants — simple ops, cheap, fast to query.
- RLS enforces isolation even if app code has a bug; can't accidentally leak across tenants.
- All migrations must include RLS policies alongside schema changes. Untested RLS is a security hole.
- Local dev + integration tests must assume RLS is on. Use `.setConfig('app.tenant_id', ...)` or JWT mocking to test per-tenant queries.

## Alternatives considered

- **Schema-per-tenant** — better isolation, massively harder ops, doesn't scale past a few hundred tenants.
- **Database-per-tenant** — ruled out for cost and ops burden.
- **App-level filtering** — historically bug-prone; one missed `where tenant_id = ?` leaks data.

## Testing requirement

Every integration test that touches a multi-tenant table must run with RLS on and an appropriate session context. Tests that depend on cross-tenant visibility must explicitly use the service-role client and assert behaviour.

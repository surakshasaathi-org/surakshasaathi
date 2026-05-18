# ADR 0007 — Single Next.js app deployment (admin merged into customer)

- **Status:** Accepted
- **Date:** 2026-05-18
- **Supersedes:** —
- **Amends:** ADR 0006 (Vercel topology — replaces the two-project plan)

## Context

ADR 0006 specified two Vercel projects — `surakshasaathi-customer` and `surakshasaathi-admin` — each pointing at the same monorepo with different Root Directory settings. That is the canonical pattern for a Next.js monorepo.

In practice, attempting to provision the second Vercel project hit unresolved UI friction. Rather than block on Vercel-side troubleshooting, we are collapsing the customer and admin apps into a single Next.js codebase so the entire monorepo deploys as one Vercel project.

## Decision

Merge `apps/web-admin/` into `apps/web-customer/` and delete the standalone admin app. The merged app is the only one deployed to Vercel for MVP. `apps/web-partner/` and `apps/web-support/` remain in the monorepo as deferred apps — neither is touched and neither deploys.

### Routing

- Customer pages keep their `[locale]`-prefixed routes (i18n).
- Admin pages move to `apps/web-customer/src/app/admin/*`, **outside** the `[locale]` segment. Admin is internal-team, English-only, and should not carry locale prefixes.
- Admin API routes move under `apps/web-customer/src/app/api/admin/*`.
- Public URL shape:
  - Customer: `surakshasaathi.com/{locale}/...`
  - Admin: `surakshasaathi.com/admin/...`

### Auth boundary

The customer app's middleware grows one branch for `/admin/*`:

- `/admin/sign-in` and `/admin/403` are reachable unauthenticated.
- All other `/admin/*` paths require a Supabase session **and** an `org_memberships` row whose `role` is one of: `admin`, `case_manager`, `content_editor`, `cx_agent`, `viewer`.
- Auth failure → redirect to `/admin/sign-in`.
- Role failure → render `/admin/403` (a separate page from the customer-facing `/403` to avoid leaking the admin surface).

The admin sign-in flow is distinct from the customer flow: different UX, different post-auth redirect (`/admin` vs `/{locale}/my`).

### Build & deploy

- Single Vercel project: `surakshasaathi-customer` (name retained to reduce churn; expand the description in the dashboard to "merged app").
- Single Sentry project. Server-side context tagged `surface=admin|customer` at instrumentation time.
- Single env-var set. `SENTRY_PROJECT_ADMIN` becomes obsolete and is removed.

## Why not alternatives?

- **Two Vercel projects (ADR 0006 original plan):** still the architecturally correct shape, but blocked on Vercel UI provisioning today. We accept the trade-offs below to unblock MVP launch.
- **`admin.surakshasaathi.com` via Next.js multi-zones:** multi-zones still require multiple deployed Next.js apps — it doesn't collapse to one project. Rejected.
- **`admin.surakshasaathi.com` via Vercel rewrite to `/admin/*`:** workable but adds a routing layer for purely cosmetic URL reasons. Defer until compliance or marketing requires the subdomain.
- **Keep `apps/web-admin/` and don't deploy it:** the admin app would rot, the team would lose ability to use it, and we'd carry a maintenance burden for code that ships nowhere. Rejected.

## Consequences

**Lost vs the two-project plan:**

- **Cookie isolation:** customer and admin cookies share `surakshasaathi.com` origin. A separate subdomain would have given a stronger boundary. Mitigated with route-scoped cookies and strict `SameSite=Strict + HttpOnly + Secure` on admin session cookies, but the mitigation is weaker than origin isolation.
- **Blast radius:** a build break in admin code blocks the customer app deploy too. We accept this for MVP — it's the same risk profile as a typical Next.js app with multiple route groups.
- **Bundle exposure:** admin route bundles are reachable by anyone hitting `/admin` (Next.js route-level code splitting means non-admin pages don't download admin chunks, but a curious visitor can fetch them). Treat admin client code as not-secret — never bake secret business rules into the client; keep gates server-side.
- **Independent rollback:** admin and customer can no longer be rolled back independently. A bad admin deploy means rolling back the whole app.

**Gained:**

- One Vercel project, one env-var matrix, one DNS record set, one Sentry, one CI build artifact.
- Local dev is a single `pnpm dev` instead of two.
- Shared utilities can be co-located instead of routed through `packages/*` when the use case is narrow.

## Future triggers for revisit (split back to two projects)

- A compliance audit requires cookie/origin isolation between admin and public surfaces.
- The admin team grows past ~5 people and independent deploy cadence becomes valuable.
- Vercel UI provisioning friction is resolved and we want to take the architectural win.
- Admin bundle exposure becomes a meaningful concern (e.g. enterprise customer demands separation).

## Execution plan

This ADR codifies the decision only. Implementation happens in follow-up PRs:

1. **This PR** — ADR 0007 + CLAUDE.md session-decisions update.
2. **Next PR** — `refactor: move web-admin into web-customer/admin`. Mechanical file moves + import rewrites + middleware update + Sentry consolidation. Large diff, low semantic complexity.
3. **Following PR** — `test: admin auth boundary tests`. Vitest cases for the middleware RBAC. Required before the merged app sees prod traffic.

`apps/web-admin/` is deleted in step 2. `apps/web-partner/` and `apps/web-support/` are not touched.

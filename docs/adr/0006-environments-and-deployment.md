# ADR 0006 — Environments, deployment topology, and prod migration gate

- **Status:** Accepted
- **Date:** 2026-05-18
- **Supersedes:** —

## Context

Phase 1 MVP targets four Next.js apps in the monorepo (`web-customer`, `web-admin`, `web-support`, `web-partner`). For the May 2026 cut, only `web-customer` and `web-admin` go to public-facing infra; `web-support` and `web-partner` defer to Vercel preview-URL-only until their respective product modules ship.

Constraints from CLAUDE.md and ADR 0001:

- DPDP requires data residency in India. Both Postgres instances must live in Mumbai (`ap-south-1`).
- No direct push to `main` (CLAUDE.md §2). GitHub Free plan blocks branch-protection rulesets on private repos, so the rule is enforced socially + by AI until the org upgrades to Team.
- Prod DB credentials must never sit on a developer laptop.

## Decision

### Two environments

| | UAT | Production |
|---|---|---|
| Supabase project | `surakshasaathi-uat` (Mumbai) | `surakshasaathi-prod` (Mumbai) |
| Consumers | local dev via `.env.local`, Vercel Preview + Development env | Vercel Production env only |
| Third-party keys | test-mode (Razorpay test, WATI sandbox, Anthropic dev key) | live-mode |
| Migration cadence | every PR that ships a schema change | manual, gated workflow, after merge to `main` |
| Data | synthetic / seed only — no production PII ever | real customer data |

There is intentionally no third "staging" environment. UAT is shared between local dev and Vercel previews to keep the matrix tractable; we revisit if regression patterns demand isolation.

### Vercel projects

| Vercel project | App | Production domain | Preview |
|---|---|---|---|
| `surakshasaathi-customer` | `apps/web-customer` | `surakshasaathi.com` + `www.surakshasaathi.com` | `*.vercel.app` |
| `surakshasaathi-admin` | `apps/web-admin` | `admin.surakshasaathi.com` | `*.vercel.app` |

Each Vercel project's three env scopes map deterministically:

- **Production** → prod Supabase keys + live third-party keys
- **Preview** → UAT Supabase keys + test third-party keys
- **Development** → UAT Supabase keys (so `vercel env pull` produces a working local config)

Service-role keys are server-only env vars (no `NEXT_PUBLIC_` prefix).

### Database connections

Two connection strings, both required:

- `DATABASE_URL` — Supabase **pooled** connection (port 6543, Transaction mode). App runtime. Survives Vercel's many-short-lived-functions pattern.
- `DIRECT_DATABASE_URL` — Supabase **direct** connection (port 5432). Drizzle migrations only. Required because Drizzle uses advisory locks that don't work through the pooler.

### Domain & DNS

- Registrar: GoDaddy.
- DNS: Vercel-native (no Cloudflare in front for MVP). Records added at GoDaddy:
  - `@` `A` → `76.76.21.21`
  - `www` `CNAME` → `cname.vercel-dns.com.`
  - `admin` `CNAME` → `cname.vercel-dns.com.`
- SSL: Vercel-issued Let's Encrypt, auto-renewed.

### Prod migration gate

Production schema changes run via the `db-migrate-prod` GitHub Actions workflow:

- `workflow_dispatch` only — never on push.
- Targets the `production` GitHub Environment, which has a required-reviewer rule. A human must click "Approve" in the GitHub UI before the migration job runs.
- `DIRECT_DATABASE_URL` for prod is stored as an environment-scoped secret. It is not available to PRs, the `main` branch's CI run, or any other workflow.
- Local laptops never hold a prod DB credential.

UAT migrations are not gated — anyone with the UAT secret can run `pnpm db:migrate` against UAT.

## Why not alternatives?

- **Three environments (dev / staging / prod):** rejected for Phase 1. The marginal regression coverage doesn't justify the secret-management and cost overhead pre-PMF. Revisit at first incident traceable to UAT/staging conflation.
- **Vercel + Cloudflare in front for DNS:** rejected for MVP. Vercel-native DNS is one fewer service to manage; we'll add Cloudflare if/when we need WAF rules or India-edge customization.
- **Push-button prod migrations from a developer laptop:** rejected outright. Laptops get stolen, env files leak, and `DROP TABLE` typos happen. The PR-then-Actions-approval path adds 60 seconds and removes a whole class of incidents.
- **GitHub Pro/Team for branch protection on day one:** deferred. Cost is modest ($4/user/mo) but not load-bearing while the team is one human + one AI. Revisit on first new human collaborator.

## Consequences

- Pro: clean 1:1 mapping from env → Supabase project → third-party tier; no chance of test cards charging prod Razorpay.
- Pro: prod DB credentials live only in two places — Supabase dashboard and GitHub Environment secret. Rotatable from either.
- Con: until GitHub Team upgrade, `main` is only protected by social/AI rules. A misclick by an admin with push rights bypasses everything.
- Con: shared UAT means a developer running `pnpm db:migrate` locally can disrupt a teammate's preview deploy. Tolerable at current team size.

## Future triggers for revisit

- First human collaborator joins → upgrade to GitHub Team, enable rulesets, retire the social rule.
- First UAT regression caused by a teammate's in-flight schema change → introduce a third "staging" Supabase project.
- First Razorpay / WATI cost overrun in a Vercel preview → split preview third-party keys from local-dev third-party keys.
- `web-support` or `web-partner` reaches user-facing scope → add their Vercel projects + DNS records.

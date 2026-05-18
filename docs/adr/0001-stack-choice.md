# ADR 0001 — Stack choice: TypeScript + Next.js + Supabase + Vercel

- **Status:** Accepted
- **Date:** 2026-04-18
- **Supersedes:** —

## Context

SurakshaSaathi is a multi-tenant, multi-agent insurance-advisory platform targeting millions of Indian users over a 5+ year horizon. At kickoff we are a very small team, pre-PMF. Strategy doc targets a 90-day Phase 1 MVP with 8 idea skeletons on Day 1.

Constraints:

- DPDP Act 2023 requires data residency in India for personal data of Indian residents.
- Product needs vernacular UX (English + Hindi + Kannada at MVP).
- Long-running workloads: OCR, multi-step agent chains, Ombudsman deadline watchers.
- Need to keep initial ops burden minimal to preserve engineering focus on product.

## Decision

- **Language:** TypeScript end-to-end.
- **Web framework:** Next.js 15 (App Router) + Tailwind + shadcn/ui.
- **Backend:** Next.js API routes (Server Actions where appropriate); Node/Hono microservices only when a workload outgrows the Next.js runtime.
- **Hosting (web + API):** Vercel.
- **Database, Auth, Storage, Realtime, Edge Functions:** Supabase (India region — AWS Mumbai under the hood, DPDP-compliant).
- **ORM:** Drizzle.
- **Background jobs:** Trigger.dev for durable, long-running, and scheduled workflows.
- **Agent runtime:** Anthropic SDK with tiered models (Opus / Sonnet / Haiku) and aggressive prompt caching.
- **Payments:** Razorpay (one-time + Subscriptions + escrow for success fees).
- **Messaging:** WATI for WhatsApp Business; MSG91 as SMS OTP fallback.
- **Repo + CI:** GitHub (private) + GitHub Actions.
- **Observability:** Sentry + Vercel Analytics + Supabase logs.

## Why not alternatives?

- **Python + Django** — great admin out of the box, but Next.js interactive UX is superior and a second language would slow a small team.
- **AWS direct / terraform all of it** — DPDP compliant and powerful, but requires dedicated devops from Week 1 that we don't have. Supabase collapses Postgres + Auth + Storage + Realtime + Edge Functions into a single product.
- **MongoDB or other NoSQL** — our domain is heavily relational (policies ↔ users ↔ cases ↔ schemes ↔ claims). Postgres + RLS is the right fit and Supabase makes it free.
- **Go / Rust backend** — premature. Node handles our Phase 1 throughput comfortably. We can extract hot paths to Go/Rust later, but never prematurely.

## Consequences

- Pro: Smallest possible team can ship 8 idea skeletons + admin + support portals in 90 days.
- Pro: One language, one package manager, one deploy target dramatically reduces cognitive load.
- Con: Vercel function cold starts on some routes — mitigated by edge runtime where possible and Trigger.dev for long work.
- Con: Vendor concentration (Vercel + Supabase). Explicitly accepted as a Phase 1 tradeoff. Exit plan: Supabase is plain Postgres + S3-compatible storage, so we can self-host it if needed; Next.js deploys to any Node host, not just Vercel.

## Future triggers for revisit

- \> 1M MAU on any single app.
- Vercel function-minutes bill exceeds 2× projected savings from managed hosting.
- Supabase reliability issues that materially impact users.

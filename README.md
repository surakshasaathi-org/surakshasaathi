# SurakshaSaathi

**India's Protection Companion.** A multi-tenant, multi-agent advisory platform for Indian insurance — claims recovery, policy advisory, government-scheme navigation, senior-citizen protection, mis-selling recovery, MSME risk audits, vernacular tier 2/3 education, and family insurance OS. Eight product modules, one platform.

See `docs/PRODUCT_STRATEGY.md` and `docs/ENGINEERING_INSTRUCTIONS.md` for the source of truth.
Operating rules live in `CLAUDE.md` — that's what an AI assistant reads every session.

## What's in this repo

```
.
├── apps/
│   ├── web-customer/    surakshasaathi.com — public site + customer portal
│   ├── web-admin/       admin.surakshasaathi.com — internal ops
│   ├── web-support/     support.surakshasaathi.com — CX console + AI co-pilot
│   └── web-partner/     partner.surakshasaathi.com — B2B white-label (Phase 2 slot)
├── packages/
│   ├── types/           zod-typed domain models, enums, error taxonomy
│   ├── db/              Drizzle schema, RLS policies, Day-1 seed data
│   ├── i18n/            next-intl setup + insurance glossary (human-reviewed only)
│   ├── access-control/  server-side guards: auth level × tier × flag × role × tenant
│   ├── agent-sdk/       Anthropic-backed agent runtime (Opus/Sonnet/Haiku tiered)
│   └── ui/              shared design tokens + React components
├── docs/
│   ├── PRODUCT_STRATEGY.md + .docx     8 opportunities, phasing, regulatory roadmap
│   ├── ENGINEERING_INSTRUCTIONS.md +   engineering standing rules
│   └── adr/             architecture decision records (5 so far)
├── infra/
│   ├── supabase/        (reserved) edge functions, pg_cron, SQL policies
│   └── trigger/         (reserved) Trigger.dev task definitions
└── CLAUDE.md            always-loaded project operating rules
```

## The 8 modules at a glance

| Slug | Cluster | Pricing | Status (Day 1) |
|---|---|---|---|
| `claims-advocacy` | Claims & Recovery | Success fee | Beta |
| `life-mis-selling-recovery` | Claims & Recovery | Success fee + audit | Skeleton |
| `senior-citizen-portal` | New Segments | Subscription + audit + success fee | Skeleton |
| `govt-scheme-navigator` | Advisory | Free | Beta |
| `policy-health-score` | Advisory | Freemium | Skeleton |
| `family-insurance-os` | Advisory | Subscription | Skeleton |
| `vernacular-portal` | New Segments | Affiliate + advisor franchise | Skeleton |
| `msme-navigator` | New Segments | Freemium + retainer + affiliate | Skeleton |

Adding a 9th module = insert a `product_module` row + (if needed) write an intake flow + register agents. Zero code changes to the landing page, router, or admin. See **ADR-0003**.

## Architecture (1-page)

```
┌── Channels ──────────────────────────────────────────────────────────────┐
│  Web (Next.js)       Mobile (later)       WhatsApp (WATI)                │
└───────────┬──────────────────────────────────────────────────────────────┘
            │
┌── BFF / API Gateway (Next.js API routes + Server Actions) ──────────────┐
│  Auth (Supabase)  ·  Rate limit  ·  Tenancy (JWT claims)  ·  i18n        │
│  access-control middleware (tier × flag × tenant × role, server-side)    │
└───────────┬──────────────────────────────────────────────────────────────┘
            │
┌── Domain (modular monolith) ────────────────────────────────────────────┐
│  Identity · Policy · Case · Scheme · Document · Payment · Audit · DPDP   │
└───────────┬──────────────────────────────────────────────────────────────┘
            │
┌── Agent Orchestration (Claude-backed, tiered routing) ──────────────────┐
│  IntakeAgent · DocumentAgent · RejectionClassifier · EscalationDrafter   │
│  DeadlineWatcher · MisSellingDetector · SchemeMatcher · SchemeExplainer  │
│  TranslationAgent · PolicyHealthScorer · GapFinder · MSMERiskAuditor     │
│  ReviewAgent (regulatory pre-review)                                     │
└───────────┬──────────────────────────────────────────────────────────────┘
            │
┌── Infra ────────────────────────────────────────────────────────────────┐
│  Supabase India (Postgres + RLS + Auth + Storage) · Vercel               │
│  Trigger.dev (long-running jobs) · Razorpay · WATI · Sentry              │
└──────────────────────────────────────────────────────────────────────────┘
```

## Setup

Prereqs: **Node 20+** (Node 22 works), **pnpm 9+**. Supabase + Anthropic are NOT required to run the landing page — it falls back to a static module catalog when `DATABASE_URL` is unset.

```bash
# install
pnpm install

# run the customer landing page (no env needed)
pnpm --filter @suraksha/web-customer dev
# open http://localhost:3000
# try /hi and /kn for Hindi + Kannada
```

For the full stack (admin + support + Supabase-backed):

```bash
# bootstrap env
cp .env.example .env
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# DATABASE_URL, DIRECT_DATABASE_URL, ANTHROPIC_API_KEY
cp apps/web-customer/.env.example apps/web-customer/.env.local
cp apps/web-admin/.env.example   apps/web-admin/.env.local
cp apps/web-support/.env.example apps/web-support/.env.local

# database: generate migrations + apply + seed
pnpm --filter @suraksha/db generate
pnpm --filter @suraksha/db migrate
pnpm --filter @suraksha/db seed

# i18n completeness
pnpm i18n:check

# run everything in parallel
pnpm dev
```

Then:
- `http://localhost:3000` — customer site (try `/`, `/hi`, `/kn`, `/claims-advocacy`)
- `http://localhost:3001` — admin portal
- `http://localhost:3002` — support portal
- `http://localhost:3003` — partner portal (placeholder)

## Key operating rules (short form — full in CLAUDE.md)

- **Architecture first, code second.** Proposal → approval → implementation.
- **NEVER push to main. Never run `git push` without explicit confirmation.**
- Feature branches: `feature/[idea-number]-[short-description]`.
- Govt scheme eligibility is **always free and anonymous**. Never gate it.
- No IRDAI broker license (yet). We're advisory-only: subscription + success fee + affiliate. See **ADR-0002**.
- Phone OTP is primary auth. Aadhaar eKYC only for high-value recovery (> ₹50k).
- Insurance terminology is **never machine-translated**. Human-reviewed glossary per locale.
- Multi-tenancy from Day 1. Every business row carries `tenant_id`; RLS enforces it.
- Every new insurance line / scheme / product module = a DB row, not a deploy.

## What lands next (Week 2–3)

1. **Claims-Advocacy end-to-end backend** — intake flow → OCR → RejectionClassifier → EscalationDrafter → human review → filing → success-fee capture.
2. **Govt-Scheme-Navigator eligibility backend** — SchemeMatcher driven by the `scheme.eligibility_rules` JSON DSL + locale-aware explainer.
3. **Phone-OTP auth** wired end-to-end (Supabase Auth + MSG91 fallback for reliability).
4. **Razorpay integration** — Orders, payment capture, Subscriptions, webhook handler.
5. **WATI integration** — inbound webhook → conversation thread → support portal inbox.
6. **Trigger.dev workflows** — OCR pipeline, DeadlineWatcher cron, Ombudsman SLA escalation.
7. **Admin Agent prompt editor** — insert new versions, run eval dataset, promote to default.
8. **Integration test harness** — real test-Postgres, RLS-enabled, per CLAUDE.md.

## Contributing from an AI session

Read `CLAUDE.md` first. It's the operating contract. Follow the Architecture-First protocol, ask before pushing, and use the existing patterns (DB-driven modules, config-not-code, server-side access control).

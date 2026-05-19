# SurakshaSaathi — Project Instructions

surakshasaathi.com — India's Protection Companion. Long-horizon platform (5+ year, millions of users), not a hackathon project.

**Source docs** (authoritative): `docs/SurakshaSaathi_Product_Strategy.docx` and `docs/SurakshaSaathi_Claude_Code_Instructions.docx`. Readable markdown extracts alongside. This CLAUDE.md condenses them plus in-session decisions.

## Infrastructure Status (authoritative — update on every infra change)

> **Maintenance rule:** every PR that adds an env var, wires a new vendor, or changes a deploy path must update this section in the same commit. If this drifts, future sessions will make decisions on stale facts.

### Vendors wired

| Surface | Vendor | Status | Owner email | Notes |
|---|---|---|---|---|
| Repo + CI | GitHub | active | admin@surakshasaathi.com | Org `surakshasaathi-org` (free plan; branch protection deferred — see ADR 0006). |
| Web hosting | Vercel | active | admin@surakshasaathi.com | Team `anand-s-projects8`, project `surakshasaathi-customer`. Single Next.js app (ADR 0007). Auto-deploys `main`. |
| DB + Auth + Storage | Supabase | active | admin@surakshasaathi.com | Two projects: UAT `roujwqeomynysjkvgfpf` (Sydney `ap-southeast-2`, test data only), Prod `ipdavoxivtrgcvxbfsvr` (**region pending confirmation — must be Mumbai for DPDP, see ADR 0006**). |
| Background jobs | Trigger.dev | active | admin@surakshasaathi.com | Project `surakshasaathi` ref `proj_afbawgljgtebkvjvpiws`. Env-var values set in Trigger.dev dashboard (not deploy-time env). See ADR 0008. |
| LLM | Anthropic + Google Gemini | active | admin@surakshasaathi.com | Anthropic for digitizer/extractor/reviewer; Gemini for cheaper-tier routing. Keys live in Vercel + Trigger.dev runtime env vars. |
| Domain registrar | GoDaddy | active | admin@surakshasaathi.com | `surakshasaathi.com`. DNS still on GoDaddy defaults — Vercel domain wiring pending. |
| Transactional email | Google Workspace SMTP | **pending** | noreply@surakshasaathi.com (planned) | Decided 2026-05-19. To configure: dedicated Workspace user + app password → Supabase Auth → SMTP. |
| Error monitoring | Sentry | **pending** | n/a | Env-var slots reserved; DSN not yet wired. |
| Payments | Razorpay | not started | — | Phase 2. |
| Messaging | WATI (WhatsApp), MSG91 (SMS-OTP) | not started | — | Phase 2. |

### Vercel project structure

- Single project `surakshasaathi-customer` deploys `apps/web-customer` (merged with `apps/web-admin` per ADR 0007). `web-partner` and `web-support` stay in repo but not deployed.
- Three env scopes: **Production** (prod Supabase + live keys), **Preview** (UAT Supabase + dev keys), **Development** (same as Preview).
- `next.config.mjs` has `typescript.ignoreBuildErrors=true` + `eslint.ignoreDuringBuilds=true` as a baseline workaround (PR #5). Flip back to `false` when baseline is cleaned up.

### Trigger.dev environments

- `Development` env = local laptop dev server + Vercel Preview. Uses `tr_dev_*` API key.
- `Production` env = Vercel Production. Uses `tr_prod_*` API key.
- **Env vars must be set in the Trigger.dev dashboard per environment** — they do NOT inherit from Vercel or the deploy-time machine. See ADR 0008. Same env-var list as Vercel runtime (DB URLs, Supabase keys, LLM keys, model names, USD_TO_PAISE).
- Deploy step: `npx trigger.dev@latest deploy` (manual today, CI integration tracked as follow-up).

### Database connection conventions

- `DATABASE_URL` = Transaction pooler `:6543`. Used by app runtime queries (`serviceDb()` and `tenantDb()`).
- `DIRECT_DATABASE_URL` = misleading name; varies by context:
  - In **Vercel + Trigger.dev runtime** → Transaction pooler `:6543` (NOT direct host). Required because `serviceDb()` reads this var, and runtime needs the high-concurrency pooler.
  - In **local `.env.local`** + GitHub Actions `PROD_DIRECT_DATABASE_URL` secret → Session pooler `:5432` on `pooler.supabase.com` host. Required for Drizzle's advisory locks during migrations.
  - Never use the `db.<projectref>.supabase.co` direct host — IPv6-only, breaks Vercel and most networks.
- Rename to two separate vars (`RUNTIME_DATABASE_URL` / `MIGRATION_DATABASE_URL`) is tracked as a follow-up to eliminate this confusion.

### Env var matrix (authoritative)

For each variable below: **server-only** means no `NEXT_PUBLIC_` prefix (kept out of client bundle). Set in **Vercel** for the Next.js app + **Trigger.dev dashboard** for the analyse task.

| Variable | Production value | Preview/Dev value | Where set | Server-only? |
|---|---|---|---|---|
| `NODE_ENV` | `production` | `production` (Trigger) / dev (local) | Vercel + Trigger | No |
| `NEXT_PUBLIC_APP_ENV` | `production` | `uat` | Vercel + Trigger | No |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ipdavoxivtrgcvxbfsvr.supabase.co` | `https://roujwqeomynysjkvgfpf.supabase.co` | Vercel + Trigger | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod `sb_publishable_*` | UAT `sb_publishable_*` | Vercel + Trigger | No |
| `SUPABASE_SERVICE_ROLE_KEY` | prod `sb_secret_*` | UAT `sb_secret_*` | Vercel + Trigger | **Yes** |
| `DATABASE_URL` | prod Transaction pooler `:6543` URI | UAT Transaction pooler `:6543` URI | Vercel + Trigger | **Yes** |
| `DIRECT_DATABASE_URL` | prod Transaction pooler `:6543` URI (runtime) | UAT Transaction pooler `:6543` URI (runtime) | Vercel + Trigger | **Yes** |
| `ANTHROPIC_API_KEY` | live Anthropic key | dev/test key | Vercel + Trigger | **Yes** |
| `GOOGLE_API_KEY` | live Gemini key | dev/test key | Vercel + Trigger | **Yes** |
| `GEMINI_MODEL_OPUS` | `gemini-2.5-pro` | `gemini-2.5-pro` | Vercel + Trigger | No |
| `GEMINI_MODEL_SONNET` | `gemini-2.5-flash` | `gemini-2.5-flash` | Vercel + Trigger | No |
| `GEMINI_MODEL_HAIKU` | `gemini-2.0-flash-lite` | `gemini-2.0-flash-lite` | Vercel + Trigger | No |
| `USD_TO_PAISE` | `8600` | `8600` | Vercel + Trigger | No |
| `ADMIN_BOOTSTRAP_EMAIL` | `admin@surakshasaathi.com` | `admin-uat@surakshasaathi.com` | Vercel + Trigger | No |
| `TRIGGER_SECRET_KEY` | prod `tr_prod_*` | dev `tr_dev_*` | **Vercel only** | **Yes** |
| `TRIGGER_PROJECT_REF` | `proj_afbawgljgtebkvjvpiws` | `proj_afbawgljgtebkvjvpiws` | **Vercel only** | No |
| `TRIGGER_API_URL` | `https://api.trigger.dev` | `https://api.trigger.dev` | **Vercel only** | No |
| `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` | `true` (when configured) | `true` (when configured) | Vercel | No |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | from Google Cloud Console OAuth | same | Vercel | No |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | from Google Cloud Console OAuth | same | Vercel | **Yes** |

Pending env vars (not yet wired): `RAZORPAY_*`, `WATI_*`, `MSG91_*`, `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`, `TRIGGER_PROJECT_ID` (legacy — superseded by `TRIGGER_PROJECT_REF`).

### Deploy paths

| What | When | How |
|---|---|---|
| Next.js app (customer + admin) | every push to `main` | Vercel auto-deploy |
| Trigger.dev tasks (`apps/web-customer/src/trigger/*`) | manual today | `cd apps/web-customer && npx trigger.dev@latest deploy` per env. CI integration tracked. |
| Prod DB migrations | manual, gated | `db-migrate-prod` GitHub Actions workflow → `production` GitHub Environment with required reviewer. Reads `PROD_DIRECT_DATABASE_URL` secret. |
| UAT DB migrations | manual, ungated | `pnpm db:migrate` from laptop with UAT `DIRECT_DATABASE_URL` (Session pooler `:5432`). |
| Supabase Storage buckets | applied via migration | Bucket `policy-documents` created by migration 0016. |
| Trigger.dev env vars | manual | Trigger.dev dashboard → Project Settings → Environment Variables. Required before any task deploy. |
| Vercel env vars | manual | Vercel dashboard → Project Settings → Environment Variables. |

### Things that intentionally do NOT exist yet

- Staging environment between UAT and prod (ADR 0006 — single-vendor cost discipline at MVP).
- Branch protection on `main` (GitHub Free plan paywall — ADR 0006).
- A `staging` Trigger.dev environment (free tier limit).
- Resend / Postmark / SES for email (using Workspace SMTP at MVP — decided 2026-05-19).
- A reverse proxy or CDN in front of Vercel (Cloudflare in front etc.).

## Session Decisions — 2026-05-19 (Trigger.dev for analyse pipeline)

- **Background jobs:** Trigger.dev v3 wired for the analyse pipeline. Single project `surakshasaathi` (ref `proj_afbawgljgtebkvjvpiws`); `development` env key for local + Vercel Preview, `production` env key for Vercel Production. See ADR 0008.
- **Why now:** the `after()` + `maxDuration=60` path proven insufficient in prod 2026-05-18 (`Vercel Runtime Timeout Error: Task timed out after 60 seconds`). Vercel's 60s ceiling is non-negotiable; durable background execution was the only path forward for realistic-sized policy PDFs.
- **New env vars:** `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`, `TRIGGER_API_URL`. Documented in `.env.example`.
- **Deploy step:** `npx trigger.dev@latest deploy` runs once per change to `apps/web-customer/src/trigger/*` for prod. Manual today; CI-integration tracked as follow-up.

## Session Decisions — 2026-05-18 (Infra Bootstrap)

- **Repo:** `surakshasaathi-org/surakshasaathi` (private). Personal handle `surakshasaathi` transferred to org `surakshasaathi-org`.
- **Branch protection:** deferred. GitHub Free plan blocks rulesets on private repos. Until org upgrades to Team, the no-direct-push-to-`main` rule is enforced socially + by Claude. Re-enable rulesets the day the org upgrades or the first new collaborator joins.
- **Environments:** UAT (`surakshasaathi-uat`) and Prod (`surakshasaathi-prod`), both Supabase Mumbai. UAT shared between local dev and Vercel previews. See ADR 0006.
- **Vercel projects at MVP:** single project `surakshasaathi-customer` (→ `surakshasaathi.com` + `www`). Admin merged into the same Next.js app at `/admin/*` per ADR 0007 (supersedes the two-project plan in ADR 0006). `web-support` and `web-partner` deferred — not deployed, not deleted.
- **DNS:** GoDaddy registrar, Vercel-native DNS. No Cloudflare in front for MVP.
- **Prod DB migrations:** GitHub Actions `db-migrate-prod` workflow, gated by `production` GitHub Environment with required-reviewer approval. Prod creds never leave that secret scope. See `.github/workflows/db-migrate-prod.yml`.
- **Admin bootstrap email:** the auto-promote-to-super_admin mechanism (`ADMIN_BOOTSTRAP_EMAIL`, formerly `UAT_ADMIN_EMAIL`) is now enabled in **all environments** including prod. Prod value: `admin@surakshasaathi.com` (org owner inbox, 2FA required). The variable is intentionally a foot-gun — unset it in prod Vercel once human admins have been granted via the admin portal, so the bootstrap path is closed.

## Session Decisions — 2026-04-18 (MVP Plan)

- **Verticals:** All 8 idea skeletons ship Day 1 (landing pages + intake + admin case queue). Full backends at launch: Idea 1 Claims Advocacy + Idea 3 Govt Scheme Navigator (TBC). Remaining 6 run human-in-loop behind admin portal while their backends are built.
- **Business posture:** Advisory-only, **no IRDAI broker license**. Revenue = subscription + success fees + affiliate referrals. No direct policy placement.
- **Launch languages:** English + Hindi + Kannada (MVP). Tamil/Telugu/Bengali fast-follow. Human-reviewed insurance glossaries required per language.
- **Admin portal:** 2–5 ops team, RBAC roles — admin, case_manager, content_editor, cx_agent, viewer.
- **Support portal:** In-house CX + AI co-pilot drafter. BPO-extensible later.
- **Go-live target:** 90 days to Phase 1 MVP (by 2026-07-17).


## 1. Architecture-First Protocol

Before writing code for any new feature, present an architecture proposal covering:

- Data models + schema changes
- Integration points with existing systems (auth, payments, notifications, i18n)
- Monetization tier (free / freemium / success-fee / subscription / B2B)
- Auth level required (anonymous / phone-OTP / email / Aadhaar / B2B org)
- Language scope at launch vs. later phase
- Future B2B or white-label API surface

**Do not begin implementation until the architecture is approved.** Clarify ambiguous requirements instead of assuming silently. Document significant decisions with ADR-style comments inline.

## 2. Git & Deployment — Non-Negotiable

- **NEVER** push to `main` or `master` directly.
- **NEVER** run `git push` without explicit confirmation from the product owner. No exceptions.
- Before any push, state branch + commits + changes + ask for approval; wait.
- Feature branches: `feature/[idea-number]-[short-description]` e.g. `feature/1-claims-intake-whatsapp`.
- Commit message prefixes: `feat:` `fix:` `refactor:` `docs:` `test:`. No bare "fix" or "update".
- Never force-push to shared branches.
- Production deploys only after staging sign-off. Never use prod credentials in local/staging.

## 3. Stack & Scale Defaults (locked 2026-04-18)

| Layer | Choice |
|---|---|
| Language | TypeScript end-to-end |
| Web framework | Next.js 15 (App Router) + Tailwind + shadcn/ui |
| Backend | Next.js API routes + Node/Hono for any split-out services |
| Hosting (web) | **Vercel** |
| Hosting (data + auth) | **Supabase** India region (DPDP-compliant) — Postgres, Auth, Storage, Realtime, Edge Functions |
| ORM | Drizzle |
| Auth primary | Supabase Auth — Phone OTP (primary) + email/password + Google/Apple for urban |
| Storage | Supabase Storage (S3-compatible) for policy docs, PDFs, letters. Never binaries in DB |
| Cache | Vercel edge + Postgres caching. Upstash Redis only if rate-limit / session demand exceeds Postgres |
| Background jobs | **Trigger.dev** for OCR, multi-step agent chains, deadline watchers, WhatsApp sends. Supabase Edge Functions + `pg_cron` for simple scheduled tasks |
| Search | Supabase full-text (`tsvector`) for Phase 1. Typesense later if needed |
| Messaging | **WATI** for WhatsApp; MSG91 or Gupshup for SMS-OTP if Supabase SMS is too pricey |
| Payments | **Razorpay** (one-time + Subscriptions + escrow for success fees) |
| Agent runtime | **Anthropic SDK**, tiered: **Opus** for classifiers, **Sonnet** for drafters, **Haiku** for routing. Aggressive prompt caching everywhere. |
| Repo + CI | **GitHub (private) + GitHub Actions**. Vercel preview deploys on every PR |
| Observability | Sentry + Vercel Analytics + Supabase logs; Grafana Cloud added if needed |
| APIs | Versioned `/api/v1/`. Rate-limited public endpoints. Auth users get higher limits |

Scale rules still apply: `EXPLAIN ANALYZE` any query on tables expected to exceed 100k rows; never block an HTTP response on a slow op.

## 4. Multi-Tenancy & Extensibility

- Every data model has `tenant_id` / `organization_id` from Day 1, even with one tenant.
- `insurance_type` is a DB configuration table, NOT a hardcoded enum. New lines (motor, crop, cyber, travel, pet) added by inserting a row.
- Insurance-type-specific business rules stored as configuration, not hardcoded.
- Currency/date/number formatting is locale-aware; regulator references (IRDAI, Ombudsman) abstracted for future geographies.

## 5. Monetization Architecture

**Business posture (decided 2026-04-18):** Advisory-only. **No IRDAI broker license.** No direct policy placement. Revenue is subscription + success-fee + affiliate referral only.

Tiers:

| Tier | Auth | Examples | Revenue |
|---|---|---|---|
| Anonymous Free | none | Govt scheme eligibility, literacy content | Acquisition |
| Registered Free | Phone OTP | Basic Policy Health Score, dashboard | Personalisation |
| Freemium Paid | Yes + payment | Full claim readiness, letter drafting, policy audits | One-time fee |
| Success Fee | Yes + case | Claim/mis-selling/unclaimed recovery | 10–15% of recovery |
| Subscription | Yes + recurring | Family OS, Senior plan, Policy Health Score premium, MSME annual review | Razorpay Subscriptions |
| Affiliate | any | Referral links to insurers' own websites (lead-gen) | Partner rev-share |
| B2B SaaS | Org account | NGO, HR, CSC white-label | Per-seat/per-employee |

**Non-negotiables:**
- Govt scheme eligibility check is **always free and anonymous**. Never gate.
- **No broker-transacted placements.** All insurer cross-sell goes through affiliate links to the insurer's own site — we never take money or policy details for a transaction.
- All feature-access and tier checks go through a standalone **access-control middleware**. Never scatter `if (user.isPremium)` across components.
- All monetization checks **server-side**. Client-side is bypassable.
- Feature flags for paid/freemium (DB-backed) — not code branches.
- Razorpay only for payments. No raw card data (tokens only). Razorpay Subscriptions for recurring. Success-fee = escrow or manual trigger with audit log. Full audit trail on every payment event.

## 6. Auth & Identity

- **Phone OTP** is the primary B2C signup — most target users don't use email as primary identifier.
- Email/password + Google/Apple as secondary for urban users.
- **Aadhaar eKYC** only for high-stakes actions (recovery > ₹50k, broker-linked policy access, B2B admin). Never require Aadhaar for features that don't legally require identity verification.
- JWT 15 min + refresh 7 days, with refresh token rotation.
- Device fingerprint + IP + UA logged for all auth events.
- "Logout everywhere" must work.

## 7. DPDP Act 2023 Compliance

- Collect only what is needed; every field documents its purpose.
- Granular consent (not all-or-nothing) at point of collection.
- Right-to-access within 72 hours.
- Right-to-erasure.
- Retention policy per data type (policy docs 7yr, session logs 90d).
- Never sell or share user data without explicit opt-in.

## 8. Vernacular & i18n

- Launch languages (Phase 1): **Hindi, Kannada, Tamil, Telugu, Bengali**.
- Phase 2: Marathi, Gujarati, Malayalam. Phase 3: Punjabi, Odia, Assamese, Urdu.
- `react-i18next` / `i18n-js`. Strings externalized from Day 1. No hardcoded English strings in components.
- Noto fonts fallback. RTL support for Urdu.
- **Insurance terminology is human-reviewed only.** Google Translate/machine translation is NOT acceptable for insurance terms.
- TTS + voice input via Web Speech API or Sarvam AI — critical for government scheme navigator.
- Language completeness checker blocks deployment if translations are missing.

## 9. Landing Page

- Value prop understood in 5s, without scrolling.
- Above fold: pain-led headline, one-sentence sub-headline, single primary CTA, prominent language toggle, one trust signal.
- Section order: Hero → Problem (3 stats) → What We Do (3–4 clusters, not 8 ideas) → How It Works (3 steps) → Who We Help (4 personas) → Trust → Pricing Clarity → FAQ → Footer.
- Modular card-based layout for products — adding a new product line is adding a card + dedicated page, not a redesign.
- New geography = language toggle expansion, zero engineering.
- No generic happy-family stock photos.

## 10. Testing Definition of Done

A feature is DONE when all apply:

- Unit tests on core logic (eligibility, rejection classification, fee computation) — happy path + edges
- Integration tests against real (test) Postgres — **not mocks only**
- Happy path end-to-end passes
- Edge cases: empty, invalid, timeout, partial data
- Error states show useful user-facing messages (not raw errors)
- Mobile tested at 375px min width
- Tested in Hindi in addition to English (verify no layout breaks from longer strings)
- Keyboard nav + screen reader
- Razorpay test-mode flows if paid (incl. webhook success/failure/cancel)
- Auth boundaries: unauth'd can't reach auth endpoints; free-tier can't reach paid features

**Performance:** Lighthouse mobile ≥80 on public pages. P95 API latency <500ms (excluding background triggers). OCR/PDF generation is always a background job.

## 11. Security

- Input sanitisation on all user inputs (SQLi, XSS).
- File uploads: validate type, size, content.
- API auth on every endpoint — test with expired, wrong-user, missing tokens.
- Secrets scanner runs before every PR. Zero credentials in the repo.

## 12. Future-Proofing Checklist (before closing any major feature)

- New insurance line addable via DB row, no code change?
- New geography: currency, date, number, regulator all abstracted?
- Free-to-paid and paid-to-free transitions via one config change?
- 10x traffic spike — what breaks first, and is that documented?
- Background jobs throttled so we don't overload govt/insurer endpoints?
- DB connection pool sized for concurrent load?
- New engineer can onboard in one day from the README?

## The Standard

Build it like millions of families depend on it. Because they will.

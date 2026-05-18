# Week 1 Handoff — 2026-04-18

## What shipped this session

A complete scaffold (no git init, no push yet — ready for your first commit when you approve).

### Monorepo root
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- `.gitignore`, `.nvmrc`, `.editorconfig`, `.prettierrc`, `.env.example`

### docs/
- Original strategy + instructions `.docx` files stored in `docs/` with readable `.md` extracts
- 5 ADRs written:
  1. Stack choice — TypeScript + Next.js + Supabase + Vercel + Trigger.dev
  2. Advisory-only business posture — no IRDAI broker license
  3. Product-module system — every idea is a config row
  4. Multi-tenancy via Postgres RLS
  5. Agent orchestration — tiered Claude models + versioned agent definitions

### packages/ (6 packages)

- `types` — zod-typed domain models (Tenant, User, Policy, Case, Scheme, Document, ProductModule, AgentDefinition, AgentRun, FeatureFlag, Consent, etc.), shared enums, error taxonomy with user-facing messages
- `db` — full Drizzle schema across 6 domain files (tenancy, catalog, user-data, agents, commerce, compliance); hand-written `0001_rls_policies.sql`; Day-1 seed data (13 insurance lines, 1 tenant, 8 product modules, 13 agent definitions, 3 central govt schemes, 8 feature flags, 13 locales)
- `i18n` — next-intl config with `en` / `hi` / `kn` namespaces (common, hero, footer, auth, pricing), full glossary of 15 insurance terms with human-reviewed translations, language-completeness CI checker script
- `access-control` — composable guards (`requireAuth`, `requireRole`, `requireFeature`, `requireEntitlement`, `requireModuleEnabled`), server-side feature-flag evaluation, entitlement loader, unit tests
- `agent-sdk` — Anthropic SDK wrapper with tiered model router (Opus/Sonnet/Haiku), prompt caching enabled by default, tool registry, agent-registry with 60s cache, `invokeAgent` with tool-use loop (max 6 rounds), cost accounting in paise, per-run persistence contract
- `ui` — Tailwind preset + SurakshaSaathi design tokens, shared `globals.css`, components: `Button`, `Card`, `Badge`, `Container`, `ModuleCard`, `LocaleToggle`, `StatChip`

### apps/ (4 apps)

- `web-customer` — Next.js 15 App Router, `[locale]` routing via next-intl, middleware for locale detection, landing page with all 8 product cards (DB-driven), hero + problem stats + how-it-works + personas + pricing clarity + FAQ + closing CTA + footer, generic per-module landing page template, sign-in page stub
- `web-admin` — Admin shell with RBAC-aware navigation, pages: Overview, Case queue (reads from DB), Reviews, Schemes, Product modules, Agents (reads from DB), Feature flags, Users & roles, DPDP requests, Audit log, Settings, Sign-in, 403
- `web-support` — 3-column inbox layout, Customer list + Macros + Co-pilot settings pages, AI co-pilot sidebar component
- `web-partner` — placeholder for Phase-2 B2B white-label

### Infra

- `infra/supabase/` and `infra/trigger/` folders reserved (empty for now)

## What needs to happen before anyone runs `pnpm dev`

1. **Create a Supabase project** in the India region. Copy URL + anon key + service role into each app's `.env.local`.
2. **Generate the Drizzle migration** from the schema (`pnpm --filter @suraksha/db generate`). This will produce `migrations/0000_initial.sql`. The hand-written `0001_rls_policies.sql` runs after.
3. **Apply migrations** (`pnpm --filter @suraksha/db migrate`) and seed (`pnpm --filter @suraksha/db seed`).
4. **Anthropic API key** in the root `.env` — needed for the agent-sdk to invoke Claude.
5. **Install dependencies** (`pnpm install`) — this will pull the Anthropic SDK, Drizzle, Supabase clients, next-intl, etc.
6. **Type-check** (`pnpm typecheck`) — expect some issues we didn't catch statically; fix in a follow-up PR.

## Known rough edges / TODO

These are acceptable for a scaffold, but list them explicitly so we don't forget:

- **Drizzle migration SQL not yet generated.** We wrote the schema; the `drizzle-kit generate` output isn't checked in. First CI run will produce it. The RLS file assumes table names matching our schema — verify after generate.
- **Phone-OTP route handler not built.** `/sign-in` posts to `/api/auth/request-otp` which doesn't exist yet — Week-2 Day-1 task.
- **Razorpay integration is stubs-only.** `subscription` and `payment` tables exist; no webhook handler or client SDK wiring.
- **WATI webhook not implemented.** Support inbox renders placeholder conversations.
- **Admin `requireAdminSession` short-circuits to `admin` role.** Until the `membership` lookup is wired, every signed-in user is full admin — fine for a private scaffold, **critical to fix before any real team joins**.
- **Tool implementations stubbed.** `registerTool` is ready, but the 12 tools referenced in the agent definitions (lookup_scheme, extract_policy_fields, lookup_rejection_patterns, etc.) have no handlers yet — Week-2 task per module.
- **Trigger.dev workflows not defined.** `infra/trigger/` is empty.
- **Audit-log write middleware not wired.** Every service-role DB call should log — TODO.
- **`product_module` eligibility check does not honor tenant.enabled_modules server-side yet for every route.** Landing page filters correctly; module pages don't check yet.
- **No tests beyond `access-control/guards.test.ts`.** Per CLAUDE.md §10 every feature needs full test coverage — Week-2 task.

## When you're ready to commit

Follow **ADR-rule + CLAUDE.md §2**: create a feature branch, never push to main, wait for explicit approval.

Suggested first commit:

```bash
cd "/Users/anandmohan/cursor projects/Suraksha Saathi"
git init
git checkout -b feature/0-platform-scaffold
git add .
git commit -m "feat: platform scaffold — 4 apps, 6 packages, 5 ADRs, Day-1 seed"
# DO NOT push yet. Review, tweak, then push when you want.
```

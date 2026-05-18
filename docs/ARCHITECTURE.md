# SurakshaSaathi — Architecture Review

**Status:** Living document · Last updated 2026-04-19
**Scope:** Everything we've built so far, how the pieces fit, and what flips when we go from local dev → production.

This is the technical source of truth when you're deciding what to change, hire for, or fund. ADRs under `docs/adr/` own individual decisions; this file is the whole-system view.

---

## 1. One-line positioning

SurakshaSaathi is a **platform for winning every protection claim — before, during, and after.** The Before-chapter flagship is `Analyse my policy` (the feature we've built backend for today). Every other module is a moment in the same lifecycle, sharing the same infrastructure.

---

## 2. High-level architecture

```
┌─ Channels ─────────────────────────────────────────────────────────────┐
│  Web (Next.js 15)    ·    (later) WhatsApp (WATI)    ·    Mobile       │
└────────────┬───────────────────────────────────────────────────────────┘
             │
┌────────────┴─────────────── Apps (Next.js 15, App Router) ─────────────┐
│                                                                        │
│   web-customer  (port 3000)          web-admin  (port 3001)            │
│   ─────────────                      ──────────                        │
│   Public surface:                    Ops surface:                      │
│   - Landing (Before/During/After)    - Live analyses table             │
│   - Upload + progress + report       - Per-run agent breakdown         │
│   - Multi-locale (en/hi/kn)          - Agent prompt editor (versions)  │
│   - Anonymous; opaque share URLs     - RBAC (dev bypass in local)      │
│                                                                        │
│   web-support (3002) · web-partner (3003) — placeholder shells         │
└────────────┬───────────────────────────────────────────────────────────┘
             │
┌────────────┴─── BFF / Server Actions (Next.js API routes) ─────────────┐
│                                                                        │
│   Per-request:                                                         │
│     - Request validation + rate limiting                               │
│     - Access-control middleware (tier × flag × tenant × role)          │
│     - Server Actions for mutations (no exposed REST yet)               │
│     - Tenant-scoped DB client (Postgres RLS enforces on every query)   │
└────────────┬───────────────────────────────────────────────────────────┘
             │
┌────────────┴────────── Shared Domain Packages ─────────────────────────┐
│                                                                        │
│   @suraksha/types           zod schemas + branded IDs                  │
│   @suraksha/db              Drizzle schema + RLS + seed + tenantDb()   │
│   @suraksha/access-control  tier × flag × role × tenant gates          │
│   @suraksha/agent-sdk       Gemini-backed agent runtime + tool registry│
│   @suraksha/i18n            next-intl + insurance glossary (human-verified)│
│   @suraksha/ui              shadcn-style components + Tailwind preset  │
└────────────┬───────────────────────────────────────────────────────────┘
             │
┌────────────┴─── Supabase (local dev) / Postgres 17 ────────────────────┐
│                                                                        │
│   Tables (28):                                                         │
│   - Tenancy: tenant, app_user, membership                              │
│   - Catalog: insurance_line, product_module, scheme, intake_flow,      │
│              locale_meta                                               │
│   - User data: policy, case, case_event, document                      │
│   - Analyses: policy_document, policy_analysis                         │
│   - Agents: agent_definition (versioned), agent_run, review_task       │
│   - Commerce: feature_flag, entitlement, subscription, payment,        │
│               affiliate_partner, affiliate_click                       │
│   - Compliance: consent, audit_log, dpdp_request                       │
│                                                                        │
│   RLS: every business table gates reads/writes by tenant_id claim;     │
│   policy_analysis also gates by session_token match.                   │
│                                                                        │
│   17 enum types: role, locale, case_status, ocr_status,                │
│   analysis_status, model_tier, pricing_model, …                        │
└────────────────────────────────────────────────────────────────────────┘
             │
┌────────────┴────────────── External services ──────────────────────────┐
│  Google Gemini      - 2.5 Pro / 2.5 Flash / 2.0 Flash-Lite             │
│                        Native PDF vision (no OCR vendor needed)        │
│  Supabase Storage   - (not in local dev — dev writes to /tmp)          │
│  Razorpay           - not used in Phase 1                              │
│  WATI WhatsApp      - not used in Phase 1                              │
│  Trigger.dev        - deferred (we run pipeline inline for now)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Runtime topology

### Local development (where we are today)

- **Process 1**: `web-customer` on `:3000` (Next.js dev server, hot reload)
- **Process 2**: `web-admin` on `:3001`
- **Process 3**: Supabase local stack via Docker Compose
  - Postgres 17 on `:54322`
  - Auth API on `:54321`
  - Supabase Studio UI on `:54323`
  - Mailpit (email inspector) on `:54324`
- **File storage**: `/tmp/suraksha-uploads/<analysis-id>/<filename>` (7-day TTL — will move to Supabase Storage in prod)
- **Agent runtime**: inline with the customer app process — `runAnalysisPipeline(id)` runs in-process, writes agent_run rows live, updates policy_analysis status as it goes
- **Credentials**: `.env.local` (gitignored) holds Supabase keys (generated by `supabase start`) + `GOOGLE_API_KEY`

### Production (target — Phase 1.5)

- **Web apps**: Vercel (SSR + ISR + Server Actions)
- **DB + Auth + Storage + Realtime**: Supabase India region (AWS Mumbai) — DPDP-compliant data residency
- **Background workflows**: Trigger.dev (durable runs, retries, scheduled cron for the 7-day TTL cleanup)
- **Agent runtime**: runs on Trigger.dev workers instead of inline
- **File storage**: Supabase Storage bucket `policy-docs` with RLS on read/write
- **Observability**: Sentry + Vercel Analytics + Supabase logs
- **CDN**: Cloudflare in front of Vercel for edge cache + DDoS
- **Secrets**: Vercel env + GitHub Secrets (never in repo)

The dev → prod flip is almost entirely environment variables. Application code has one path; the differences are behind feature flags + env detection.

---

## 4. Data model (what's in Postgres today)

### Core relationships

```
tenant  ←─┬── membership ──→ app_user
         │
         ├── product_module  (8 rows — claims-advocacy, govt-scheme-navigator, …)
         ├── insurance_line  (13 rows — health, life, motor, …)
         ├── scheme          (versioned PM-JAY, PMSBY, PMJJBY + state schemes)
         ├── agent_definition (13 rows at v1 — intake, document, policy-analyzer, …)
         └── feature_flag    (8 rows — gates per-tenant, per-role, per-user)

policy_document ───────────→ policy_analysis ←──── (opaque session_token)
       │                            │
       │                            ├── readiness_score, red_flags_count,
       │                            │   confidence_overall, agent_run_ids[]
       │                            │
       ↓                            ↓
    agent_run (N per analysis; tokens, cost_paise, latency_ms, outcome)

case (Claims Advocacy active cases — Phase 2+)
  ├── case_event (timeline)
  ├── document   (policy docs, rejection letters)
  └── review_task (human-in-loop queue)

consent · audit_log · dpdp_request  (DPDP Act 2023 compliance)
```

### RLS policy summary

| Table | Read gate | Write gate |
|---|---|---|
| tenant | self-tenant via JWT | super_admin only |
| membership | self-tenant OR self-user | super_admin / admin |
| app_user | self-user OR admin/cx_agent | self-user / super_admin |
| product_module, scheme, insurance_line, locale_meta, agent_definition, feature_flag, affiliate_partner | anonymous read | super_admin / content_editor |
| policy, case, case_event, document, agent_run, entitlement, subscription, payment, consent, dpdp_request, review_task | self-tenant via JWT | self-tenant |
| affiliate_click | self-tenant OR anonymous | self-tenant |
| audit_log | super_admin only | any authenticated (insert) |
| policy_document, policy_analysis | session_token match OR super_admin | session_token match |

Service-role queries bypass RLS for background pipelines; every bypass is logged in `audit_log`.

### Key fields on policy_analysis

```ts
{
  id                  uuid (opaque)               // the URL key
  tenantId            text
  documentId          uuid → policy_document
  sessionToken        text                        // access gate (parallel to id)
  locale              text                        // en | hi | kn
  status              enum(queued, ocr_running, intake_running, extracting,
                           analysing, translating, reviewing, ready, failed)
  progressStep        text                        // human-visible message
  reportJson          jsonb                       // full 10-section report
  readinessScore      int                         // 0–100
  readinessComponents jsonb                       // per-dimension breakdown
  redFlagsCount       int
  confidenceOverall   real                        // 0–1
  agentRunIds         uuid[]                      // FK-less audit trail
  costPaise           int                         // integer paise, no float drift
  errorCode / errorMessage
  startedAt / readyAt / createdAt / expiresAt     // expiresAt = createdAt + 7 days
}
```

---

## 5. Agent runtime

### Model router (provider-agnostic tier names)

| Tier | Today (Gemini) | Yesterday (Anthropic, if we swap back) |
|---|---|---|
| `opus`   | gemini-2.5-pro         | claude-opus-4-7          |
| `sonnet` | gemini-2.5-flash       | claude-sonnet-4-6        |
| `haiku`  | gemini-2.0-flash-lite  | claude-haiku-4-5         |

Overridable via `GEMINI_MODEL_OPUS / SONNET / HAIKU` env. Swapping providers is a 20-line edit in `@suraksha/agent-sdk/src/run.ts` — the tier names and all agent_definition rows stay unchanged.

### Agent registry (in DB — editable from admin UI)

| Slug | Tier | Purpose | Review required? | Tools |
|---|---|---|---|---|
| `intake-agent` | haiku | Confirms health-policy scope; flags off-scope uploads | no | — |
| `document-agent` | sonnet | Extract 25+ structured fields from the policy | no | `extract_policy_fields`, `lookup_insurer_metadata` |
| `policy-analyzer` | opus | Generate 10-section report JSON | no (in MVP) | `lookup_glossary`, `lookup_urban_health_cost_bench`, `lookup_known_red_flag_patterns` |
| `translation-agent` | sonnet | Localise English → HI/KN using glossary | no | `lookup_glossary` |
| `review-agent` | opus | Citation verification + tone check on the report | no (it IS the reviewer) | `lookup_glossary` |
| `rejection-classifier` | opus | (Phase 2) Classify a rejected claim | yes | — |
| `escalation-drafter` | sonnet | (Phase 2) Draft grievance/Ombudsman letters | yes | — |
| `mis-selling-detector` | opus | (Phase 2) ULIP mis-selling signal scoring | yes | — |
| `deadline-watcher` | haiku | (Phase 2) Monitor IRDAI/Ombudsman SLAs | no | — |
| `scheme-matcher` | sonnet | (Phase 2) Map user profile to eligible schemes | no | `lookup_scheme`, `list_state_schemes` |
| `scheme-explainer` | sonnet | (Phase 2) Plain-language scheme explanation | no | `lookup_scheme` |
| `policy-health-scorer` | sonnet | (Phase 2) 5-dim score for Policy Health Score | no | — |
| `gap-finder` | sonnet | (Phase 2) Coverage-gap detection | no | — |

### Agent invocation contract (the heart of the pipeline)

```
invokeAgent({
  def: AgentDefinition,           // loaded from agent_definition (default version, cached 60s)
  invocation: AgentInvocation,    // user message + attachments + locale + extra context
  persist: PersistRunFn,          // writes an agent_run row, returns the row id
  inlineAttachments?: [...],      // PDF/image bytes → Gemini inlineData
}) → {
  runId, outputJson, outcome, confidence, needsReview, costPaise
}
```

Key properties:
- Every invocation persists an `agent_run` row — full audit trail
- Cost is computed in paise (integer) from `prompt_tokens × price_per_million + completion_tokens × price`
- Prompt caching is implicit (Gemini handles; Anthropic variant had explicit `cache_control: ephemeral`)
- Structured output via `responseMimeType: 'application/json'` + regex check on the prompt

### End-to-end pipeline (Analyse My Policy)

```
User uploads PDF/photo
          │
          ▼
Server Action startAnalysis()
  · mime + size check
  · SHA-256 of bytes
  · Write to /tmp/suraksha-uploads/ (or Supabase Storage in prod)
  · INSERT policy_document + policy_analysis (status=queued)
  · Kick background Promise runAnalysisPipeline(analysisId)
  · Redirect user to /analysis/[id]

runAnalysisPipeline(analysisId)
  status = intake_running
    invokeAgent(IntakeAgent, pdf)        → { is_health_insurance_policy, off_scope_reason }
    · if off-scope: fail with error code
  status = extracting
    invokeAgent(DocumentAgent, pdf)      → structured fields JSON
  status = analysing
    invokeAgent(PolicyAnalyzer, pdf + fields) → 10-section report JSON
  status = translating   (skipped if locale=en)
    invokeAgent(TranslationAgent, report) → localised overlay
  status = reviewing
    invokeAgent(ReviewAgent, report + pdf) → citation-verify issues
  status = ready
    UPDATE policy_analysis
      SET reportJson = ..., readinessScore = ..., redFlagsCount = ...,
          confidenceOverall = ..., agentRunIds = [run1, run2, …], costPaise = Σ

Browser polls /api/analyse/[id]/status every 2s
On status=ready → router.refresh() → Server Component re-renders with the full report
```

---

## 6. API surface (today)

### Customer web (port 3000)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` + `/[locale]` | Landing — Before/During/After chapter grid | public |
| GET | `/[locale]/[moduleSlug]` | Module landing page with waitlist | public |
| GET | `/[locale]/policy-health-score/analyse` | Upload UI | public |
| Server Action | `startAnalysis(file, locale)` | Create policy_document + policy_analysis, kick pipeline | public |
| GET | `/[locale]/policy-health-score/analysis/[id]` | Progress + report page | opaque-id gated |
| GET | `/api/analyse/[id]/status` | Status polling endpoint | opaque-id gated |
| Server Action | `deleteAnalysisAction(id)` | Immediate delete | opaque-id gated |

### Admin web (port 3001)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | Ops overview | RBAC (super_admin, admin, viewer) |
| GET | `/analyses` | List recent analyses from live DB | case_manager, content_editor, viewer |
| GET | `/analyses/[id]` | Per-analysis detail + agent-run breakdown | ^ |
| GET | `/agents` | Agent registry | content_editor, super_admin |
| GET | `/agents/[slug]` | Prompt editor + version history | content_editor, super_admin |
| GET | `/schemes` · `/modules` · `/flags` · `/users` · `/dpdp` · `/audit` · `/settings` | Ops consoles | RBAC per page |

### Not yet exposed

- Public REST API (we use Server Actions; REST will land with B2B API in Phase 2+)
- Webhook receivers (Razorpay, WATI, Trigger.dev — Phase 1.5)
- Admin mutation endpoints for agent edits (Phase 1.5 when DB is live in prod)

---

## 7. Tech stack (inventory)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 5.5 end-to-end | One language, smallest team, fastest iteration |
| Web | Next.js 15 (App Router, Server Components, Server Actions) | React Server Components for fast SSR; Server Actions kill the REST boilerplate |
| UI | Tailwind 3 + shadcn-style components + Lucide icons | Composable, accessible, fast |
| i18n | next-intl 3.26 | Namespace-based, static typing, good Server Component story |
| ORM | Drizzle 0.36 + drizzle-kit 0.28 | SQL-first, type-safe, ESM-native, lightweight |
| DB | Postgres 17 (local: Supabase CLI; prod: Supabase India) | Robust relational store + RLS + JSONB + enums |
| Auth | Supabase Auth (Phase 1.5 integration) | Phone OTP primary, email+social secondary, no PII beyond needed |
| Storage | `/tmp` (dev) → Supabase Storage (prod) | Simple swap; S3-compatible |
| LLM | Google Gemini (2.5 Pro / 2.5 Flash / 2.0 Flash-Lite) | Native PDF vision, generous free tier, competitive pricing |
| Background jobs | Inline (dev) → Trigger.dev (prod) | Durable workflows, retries, cron |
| Monorepo | pnpm workspaces + Turborepo | Fast incremental builds, clean package boundaries |
| Validation | zod | Runtime validation + TS types from the same source |
| Observability | Sentry + Vercel Analytics + Supabase logs (prod) | Low-friction; we'll add OpenTelemetry when we need it |
| CI/CD | GitHub + GitHub Actions (TBD) | Default for the ecosystem |

---

## 8. Security & compliance

### Today (what's already in place)

- **RLS on every business table** — database enforces tenant + session-token boundaries, not just app code
- **No Aadhaar collection** — never asked in Discovery/Analyse flows (CLAUDE.md §6)
- **Opaque session tokens + opaque analysis IDs** — URL itself is the access control for anonymous uploads
- **7-day TTL on analyses** — documents auto-deleted; cron in prod, manual cleanup acceptable for MVP
- **DPDP Act scaffolding** — `consent` table with granular purposes, `dpdp_request` table for access/erasure/portability, 72-hour SLA
- **Immutable audit_log** — every service-role query + every state change writes a row (retention 7 years)
- **Agent outputs cite clauses** — no invented facts; ReviewAgent verifies citations exist verbatim in the OCR text
- **Environment isolation** — prod keys never touch local/staging; local uses `.env.local` (gitignored)

### What's in flight

- **DPDP-compliant data residency** — local dev is fine; prod pin to Supabase India region
- **IRDAI posture** — advisory-only, no broker license, no transaction flows (ADR-0002)
- **Glossary-gated translations** — machine translation never used for insurance terminology; human-reviewed glossary is the source of truth

### Known gaps (acceptable for MVP, must fix before real users)

- Admin auth bypasses in local mode — before real team members use admin, Supabase magic-link + membership table look-up must land
- Rate limiting on the upload endpoint — currently none; 5/hour/IP planned before public launch
- Malware scanning on uploaded PDFs — Supabase basic scan, ClamAV if we see abuse
- Secret scanning in CI — not yet configured

---

## 9. What flips when we leave local dev

| Local dev today | Production target |
|---|---|
| File bytes to `/tmp/suraksha-uploads/` | Supabase Storage bucket `policy-docs` with signed upload URLs |
| Admin auth bypassed | Supabase magic-link + membership row lookup |
| Agent pipeline runs inline with Next.js process | Trigger.dev durable workflow |
| In-memory fallback (when DATABASE_URL unset) | Postgres always |
| `supabase start` Docker Postgres | Supabase-managed Postgres, India region |
| `GOOGLE_API_KEY` in `.env.local` | Vercel env + rotation policy |
| 7-day TTL cleanup manual | Daily cron on Trigger.dev |
| No rate limiting | 5 analyses / hour / IP (Upstash Redis token bucket) |
| No observability | Sentry + Vercel Analytics + Supabase logs |
| No CI | GitHub Actions — typecheck + lint + test + preview deploys |

Everything above is a change to `.env` or infra config. Application code has one path (detect env → behave accordingly).

---

## 10. What's actually running right now

You can verify each of these locally:

| URL | What it does |
|---|---|
| `http://localhost:3000/` | Landing page (EN) with Before/During/After chapters |
| `http://localhost:3000/hi` · `/kn` | Hindi + Kannada localised landing |
| `http://localhost:3000/policy-health-score/analyse` | Upload UI — drag-drop a PDF/image |
| After upload | Progress page polls `/api/analyse/[id]/status` — status advances |
| After ~20s | Full 10-section report renders |
| `http://localhost:3001/` | Admin ops overview |
| `http://localhost:3001/analyses` | Live DB-backed analyses table |
| `http://localhost:3001/analyses/[id]` | Per-run breakdown: 5 agents, tokens, cost, latency, outcome |
| `http://localhost:3001/agents` | Agent registry with 7-day usage stats |
| `http://localhost:3001/agents/policy-analyzer` | Prompt editor + version history |
| `http://localhost:54323` | Supabase Studio — raw SQL + table browse |

---

## 11. Open architectural questions

These are not blocking dev but need a decision before Phase 1.5:

1. **Do we keep Server Actions as the primary mutation path, or add a public REST API?** Server Actions are faster to build but harder to expose to B2B partners. Decision before Phase 2 MSME B2B work.
2. **Where does the agent eval harness live?** In-app (admin portal "Run eval") vs separate eval service. Lean in-app for MVP.
3. **Prompt caching at scale** — Gemini's implicit caching vs explicit context-caching API. We'll benchmark after first 1,000 real analyses.
4. **Hospital / scheme DB content workflow** — admin inline editing vs GitHub-flow content repo with PR reviews. GitHub-flow is more auditable; admin inline is faster.
5. **Streaming the report as sections complete** — nice-to-have, but complicates the DB + client contract. Defer.
6. **Multi-tenancy in the admin UI** — do super_admin users see all tenants at once, or do they switch tenant-context via a picker? Picker for Phase 1.5.
7. **When do we stand up the B2B `@suraksha/api` package?** Only when first partner commitment lands.

---

## 12. Reading this document

- `/docs/adr/` — individual decisions (stack, business posture, product module system, tenancy, agent orchestration, etc.)
- `/docs/prd/` — per-module product requirements (Scheme Navigator, Claims Advocacy, Analyse My Policy spec)
- `/CLAUDE.md` — operating rules AI coders read every session
- `/README.md` — setup + glossary
- This file — architecture overview; the "zoom out" view

When a decision changes, update the ADR + bump the date here. Big decisions (tech stack change, auth model, LLM provider swap) warrant a new ADR.

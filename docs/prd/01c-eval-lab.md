# Feature Spec — Eval Lab (Admin Platform Module)

> Quality + observability infrastructure for every Anthropic-powered agent in the platform. Lives in the admin app, surfaced both as a top-level hub at `/evals` and as a filtered window per product line at `/products/policy-health-score/evals`. Reviewable artifact — no code until sign-off.
>
> Parent context: `01a-analyse-my-policy.md` (the Policy Health Score module is the first heavy consumer of this Eval Lab). Adjacent: `01-claims-advocacy.md` agents become the second consumer once their backend ships. The Eval Lab itself is platform infra — not a customer-facing product.

- **Status:** Draft 2026-04-25 · Awaiting build approval
- **Module (internal):** `eval-lab` (admin)
- **Routes:**
  - `/evals` — hub (extends today's page) with tabs: Datasets · Batch Runs · Tracing · Sampling · Dashboard
  - `/evals/datasets/[datasetId]` — dataset detail (cases, edit, regen)
  - `/evals/runs/[runId]` — already exists; trace view added
  - `/evals/traces/[agentRunId]` — new full-trace viewer
  - `/evals/sampling` — per-agent rate + daily cap controls
  - `/products/policy-health-score/evals` — filtered mirror (same components, scoped to `agent_slug IN (policy-extractor, policy-coverage, customer-explainer)`)
- **Auth:** admin-only (per RBAC decision below). All other roles 403.
- **Pricing:** Internal tool. Cost-controlled via per-agent daily cap.
- **Data residency:** Supabase India. Synthetic PDFs in Supabase Storage bucket `eval-synthetic-policies` (no real customer data ever).

---

## 1. Summary

Today the platform has the bones of an eval system: `eval_golden_case`, `eval_rubric`, `eval_run`, an LLM-as-judge runner, env-var-controlled prod sampling, and admin pages at `/evals` and `/agents/[slug]/{golden-cases,rubric,regressions}`. Synthetic dataset generation, full LLM-call tracing, batch execution, an admin-controlled sampling surface, and an aggregate dashboard are missing.

The Eval Lab fills those gaps. It exists so an admin can:

1. Build and curate a versioned dataset of synthetic policy PDFs with known-correct expected outputs
2. Run any agent against one case (sync) or the whole dataset (async, Trigger.dev-backed) and get a pass/fail + cost + latency report
3. View a full LLM-call + tool-call trace of any run
4. Set the % of prod traffic that triggers a judge eval, per agent, with a hard daily cost cap
5. Trend pass-rate, cost, and latency per agent over time and catch regressions

**Decided 2026-04-25.** Day-1 scope covers Health (individual + family) policies only. Term life and motor are fast-follow when those agents exist.

---

## 2. Scope

### In scope (MVP)

- Synthetic Health-policy PDF generator (template + Faker, deterministic via seed)
- Dataset CRUD: create, edit, regenerate, upload (curated redacted PDFs blocked Day 1; see §11)
- Dataset versioning — editing a case invalidates downstream eval runs (marked `stale = true`)
- Per-case sync run ("Run this case now")
- Full-dataset async run via Trigger.dev with progress UI + cancel
- Pre-flight cost estimate before async batch run
- New `agent_run_step` table — per Anthropic API call + per tool call
- Hierarchical trace viewer (parent agent_run → children → step timeline)
- Admin-editable per-agent sampling policy (rate %, daily cap ₹)
- Auto-pause sampling when daily cap reached; resume next day at 00:00 IST
- Aggregate dashboard: pass-rate, cost, P95 latency, regression flag — last 7/30/90 days
- Cross-link from any production `/analyses/[id]` page → trace viewer for that analysis
- All Eval Lab pages gated to `admin` role

### Out of scope (fast-follow)

- Term-life and motor synthetic templates
- Curated redacted real PDF upload (DPDP risk; gated until human review SOP exists)
- Multi-rubric ensembles per agent (today: one default rubric per agent)
- A/B prompt testing harness (i.e. compare rubric v3 vs v4 on same dataset side-by-side)
- OTEL export to Grafana
- ml_engineer custom RBAC role
- Slack/email alerts on regression

---

## 3. Personas

| Persona | Role | Goal | Frequency |
|---|---|---|---|
| Founder / engineering lead | admin | Trend agent quality, catch regressions before they reach users | Daily glance, weekly deep-dive |
| QA / prompt engineer | admin | Iterate on rubrics + agent prompts; verify changes don't regress | Multiple times per day during a prompt-edit session |
| On-call engineer | admin | When a user reports a bad output, jump to the trace and root-cause in <5 min | Reactive |

Day 1 only `admin` role can access. **Decided 2026-04-25.** Other roles 403 — keep the surface tight until the workflow stabilises; we'll add `ml_engineer` once we know what to scope.

---

## 4. User Journeys

### J1 — "I changed the extractor prompt; verify nothing regressed"
1. Admin edits `policy-extractor` rubric or system prompt → bumps version
2. Goes to `/evals` → Datasets tab → picks `health-mvp-50` dataset → "Run all on agent: policy-extractor"
3. Pre-flight estimate: "~₹42, ~6 min, 50 cases" → confirms
4. Trigger.dev job kicks off; UI polls and shows "12/50 done · ₹10.2 spent · 3 fails"
5. On completion: pass-rate 94% (vs 96% on prior version) — admin clicks the 3 failed cases
6. Each failed case opens trace viewer → finds the offending LLM call → reverts prompt

### J2 — "User on /analyses/abc123 says the coverage card looks wrong"
1. On-call opens `/analyses/abc123` (admin app)
2. New "View trace" button → `/evals/traces/<agentRunId>` for the coverage agent on that analysis
3. Sees the chain: extractor (✓) → coverage (the offending one) → explainer (✓)
4. Inside coverage trace: 3 LLM calls, the second one shows the model picked up wrong waiting-period value
5. Clicks "Run judge on this run" — gets a quality_score retroactively
6. Adds the case to the golden set ("Save as golden case") for permanent regression coverage

### J3 — "Tune prod sampling for cost"
1. Admin opens `/evals/sampling`
2. Sees: `policy-extractor` 2% sampled (₹84/day), `customer-explainer` 5% sampled (₹47/day)
3. Bumps `policy-extractor` to 5% but sets daily cap ₹150 — saves
4. DB row updated; sampler reads cached policy on next prod run; UI shows "live"

---

## 5. Feature List (MVP)

### 5.1 Synthetic Dataset Builder
- Library of HTML/Tailwind templates (3 insurer look-alikes Day 1: HDFC ERGO, Star, Niva Bupa shapes)
- Faker generators: policy_number, sum_insured, premium, sub_limits map, exclusions list, waiting_periods, nominee, hospital_network_size
- Deterministic via integer seed → re-running with same seed regenerates identical PDF
- Generated via Playwright headless → PDF stored in Supabase Storage with content-hash filename
- Each generation persists an `eval_golden_case` row with `expected_extraction` / `expected_coverage` / `expected_chat_qa` populated automatically (since we generated the source)

### 5.2 Dataset Management UI
- `/evals/datasets` — list view: name, case count, last regenerated, owner
- `/evals/datasets/new` — create dataset (name, description, template mix, count, seed)
- `/evals/datasets/[datasetId]` — case grid; each row: open-PDF preview, view expected outputs, edit description/tags, mark enabled/disabled, regenerate
- "Add case from production": converts a `policy_analysis` into a golden case (PDF auto-redacted via existing `redactForModelContext`)

### 5.3 Run Execution
- **Per-case sync** ("Run this case now"): inline call to `invokeAgent`, persists `agent_run` + `agent_run_step` rows, optionally triggers `runJudge`. Result rendered inline. Cap at 1 case (UI prevents multi-select sync).
- **Full-dataset async**: enqueues a Trigger.dev `runDatasetEval` task. Job orchestrates: for each enabled case → invokeAgent(target_agent, case.input) → runJudge → write eval_run. Progress streamed back to UI via Trigger.dev runs API. Cancel button calls Trigger's cancel endpoint.
- **Pre-flight estimate**: `estimated_cost = avg_cost_per_case_last_30d * case_count`. If > ₹100, modal requires explicit confirm; if > daily cap remaining for that agent, blocked entirely.

### 5.4 Tracing
- New table `agent_run_step` (see §6) capturing every LLM call + tool call inside an `agent_run`
- Hooks into `@suraksha/agent-sdk` `invokeAgent` to emit step rows during execution
- `/evals/traces/[agentRunId]` — split view:
  - Left: hierarchy tree (this run → child runs if any, e.g. extractor → coverage when chained)
  - Right: per-step timeline with model, tokens, cost, latency, prompt-cache hit %, redacted prompt (collapsible), redacted completion (collapsible), tool args+result if step is a tool call
- "Overall trace per analysis" view: when an analysis fans out across 3 agents, all three runs shown as siblings under the analysis_id

### 5.5 Sampling Control
- New table `eval_sampling_policy` (agent_slug, rate_pct, daily_cap_paise, enabled, updated_by, updated_at)
- `maybeSampleForEval` migrated to read from this table (cached 60s in-process to avoid DB hit per prod request); env var becomes fallback default if no row
- `/evals/sampling` UI: row per agent, slider 0–100%, daily cap field, today's spend bar, toggle
- Daily reset cron (Supabase pg_cron or Trigger.dev) at 00:00 IST clears today's-spend counter

### 5.6 Aggregate Dashboard
- `/evals` (existing page, expanded) — tiles per agent_slug:
  - Pass-rate trend, last 7d / 30d
  - P95 latency
  - Total cost (judge + sampled prod runs) for period
  - Regression flag: red if pass-rate dropped > 10pp vs prior period
- Filterable by trigger: nightly_cron / manual / prod_sample
- Click-through to `/evals/runs?agentSlug=X&trigger=Y`

### 5.7 Per-product mirror
- `/products/policy-health-score/evals` — same components, agent_slug filter pre-applied to the 3 Policy Health Score agents (`policy-extractor`, `policy-coverage`, `customer-explainer`). Single shared component tree; the route just preselects a filter.

---

## 5b. Scalability & Cross-Product Extensibility (load-bearing)

**Decided 2026-04-25.** The Eval Lab is platform infra. Adding a new product line (Claims Advocacy, Govt Scheme Navigator, Mis-selling Recovery, Senior Portal, MSME, etc.) must be a **configuration change, not a UI/code rewrite**. Concretely:

- **Agent-slug-driven, never product-hardcoded.** Every UI component (dataset list, run table, trace viewer, dashboard tile, sampling row) takes `agent_slug[]` as a filter prop. Nothing in the component tree references "policy" or "health". Adding Claims Advocacy is: insert rubric rows for `claim-letter-drafter`, add a row to `eval_sampling_policy`, add a template family to the generator registry — zero React changes.
- **Per-product route is a thin shell.** `/products/[productSlug]/evals` is a server component that resolves `productSlug → agent_slug[]` from a `product_module` config table (already exists per CLAUDE.md §4) and renders the same hub components with that filter pre-applied. Adding a new product = one row in `product_module` listing its agent slugs.
- **Pluggable PDF template registry.** Templates live in `packages/eval-lab/templates/<insurance_line>/<insurer>/` exporting a `{ render(seed, faker) → html, defaultExpected(seed) → expectedOutputs }` interface. The generator iterates the registry; new lines (term-life, motor, crop, cyber) are added by dropping a folder, no generator changes.
- **Insurance-line-aware schema.** `eval_dataset.insurance_line` and `eval_golden_case.insurance_line` are FKs to the existing `insurance_type` config table — already DB-row-driven per CLAUDE.md §4. Filters across the Eval Lab respect this column.
- **Expected-output schema is per-agent, not per-product.** Each agent declares its expected-output JSON Schema in `agent_definition.expected_output_schema` (new column). The dataset builder reads that schema to know what fields a golden case must populate. Adding a new agent = registering its schema; the dataset UI auto-generates the right form fields.
- **Trace viewer is agent-shape-agnostic.** It reads `agent_run_step` rows generically; it does not know what the agent does. Works for any new agent on Day 1 of that agent existing.
- **Judge runner is already agent-slug-driven** (today's `runJudge` looks up rubric by `agent_slug`). Keep that property — never special-case per agent inside the runner.
- **Dashboard widgets self-discover agents.** Dashboard tiles are generated from a `SELECT DISTINCT agent_slug FROM agent_definition WHERE enabled = true`. New agents appear automatically; no manual dashboard edit.
- **Packages, not app folders.** Reusable parts (template registry, PDF generator, trace renderer, judge runner) live in a new `packages/eval-lab` workspace package — consumable by `web-admin`, `web-support` (for agent-assisted CX), and future internal tools without copy-paste.

**Acceptance test for "scalable":** When Claims Advocacy backend is built (Phase 1, ~Week 8), bringing it under the Eval Lab should take ≤ 1 day of work — and that day is spent writing rubric prompts + claim-letter HTML templates, not editing Eval Lab components.

---

## 6. Data Model — New Tables / Changes

### 6.1 New: `eval_dataset`
```
id uuid pk
name text not null
description text
insurance_line text not null            -- 'health' Day 1
template_mix jsonb                      -- {hdfc: 0.4, star: 0.4, niva: 0.2}
seed integer not null
case_count integer not null
created_by uuid → app_user
created_at, updated_at
```

### 6.2 Change: `eval_golden_case`
- Add: `dataset_id uuid → eval_dataset(id) on delete set null`
- Add: `synthetic boolean not null default false`
- Add: `seed integer` (per-case seed for regeneration)
- Add: `template_slug text` (which insurer template generated it)
- Add: `stale boolean not null default false` (set true when expected outputs are edited; eval_runs prior to that mark are dimmed in UI)

### 6.3 New: `agent_run_step`
```
id uuid pk
tenant_id uuid not null
agent_run_id uuid → agent_run(id) on delete cascade
step_index integer not null             -- 0,1,2,... within the run
kind text not null                      -- 'llm_call' | 'tool_call'
model_id text                           -- 'claude-opus-4-7' etc, null for tool calls
tool_name text                          -- null for llm_calls
input_tokens integer
output_tokens integer
cache_creation_input_tokens integer
cache_read_input_tokens integer
cost_paise integer not null default 0
latency_ms integer
prompt_redacted text                    -- already redacted via redactForModelContext
completion_redacted text
tool_args_json jsonb
tool_result_json jsonb
error_message text
started_at timestamptz not null
ended_at timestamptz
unique (agent_run_id, step_index)
index (agent_run_id, started_at)
```

### 6.4 New: `eval_sampling_policy`
```
agent_slug text pk
rate_pct numeric(5,2) not null default 0   -- 0.00..100.00
daily_cap_paise integer not null default 50000  -- ₹500 default
spend_today_paise integer not null default 0
spend_day_key date not null                -- IST date; reset by cron
enabled boolean not null default true
updated_by uuid → app_user
updated_at timestamptz
```

### 6.5 New: `eval_batch_run`
```
id uuid pk
dataset_id uuid → eval_dataset
agent_slug text not null
agent_version integer not null
trigger_run_id text                       -- Trigger.dev run id
status text not null                      -- 'queued'|'running'|'completed'|'cancelled'|'failed'
total_cases integer
completed_cases integer
failed_cases integer
estimated_cost_paise integer
actual_cost_paise integer
started_by uuid → app_user
started_at, ended_at
```

### 6.6 Change: `eval_run`
- Add: `batch_run_id uuid → eval_batch_run on delete set null` — links a single eval_run to its parent batch when applicable

### 6.7 New: `trace_view_audit`
```
id uuid pk
admin_id uuid → app_user not null
agent_run_id uuid → agent_run on delete cascade
viewed_at timestamptz not null default now()
index (agent_run_id, viewed_at)
index (admin_id, viewed_at)
```
Written on every GET to `/evals/traces/[agentRunId]`. Retained per DPDP audit-log policy (separate from 90d step retention).

---

## 7. Agents + Tools

The Eval Lab itself uses **no new agents**. It exercises existing agents:
- `policy-extractor` (Opus)
- `policy-coverage` (Opus)
- `customer-explainer` (Sonnet)
- Judge models per `eval_rubric.judge_model_tier`

The **synthetic PDF generator is deterministic code**, not an agent. No LLM is involved in dataset generation — that would defeat the purpose of "known-correct expected outputs."

---

## 8. Integrations

| System | Use |
|---|---|
| Supabase Storage | Bucket `eval-synthetic-policies`, content-hashed filenames, 1-year retention |
| Trigger.dev | `runDatasetEval` task (new), cancel + progress polling |
| Anthropic SDK | Existing `invokeAgent` instrumented to emit `agent_run_step` rows |
| Playwright | Headless Chromium for HTML→PDF (runs inside Trigger.dev task or Vercel function for single PDF) |
| Faker (`@faker-js/faker`) | Field generation seeded by `eval_golden_case.seed` |
| pg_cron / Trigger.dev cron | Daily-reset of `eval_sampling_policy.spend_today_paise` at 00:00 IST |

No new external vendors. No new third-party API surface.

---

## 9. Monetization

Internal tool. Cost-side only. **Decided 2026-04-25.** Daily cap per agent is the hard guardrail (default ₹500/agent/day = ₹1500 across the 3 Phase-1 agents). Pre-flight estimate gates batch runs > ₹100. No customer-facing surface, no user-tier gating logic.

---

## 10. MVP vs. Fast-Follow

| Feature | MVP | Fast-follow |
|---|---|---|
| Health synthetic templates | ✓ (3 templates) | More templates (5–8) |
| Term-life templates | | ✓ |
| Motor templates | | ✓ |
| Curated redacted real PDFs | | ✓ (after redaction-review SOP exists) |
| Per-case sync run | ✓ | |
| Full-dataset async run | ✓ | |
| Cancel batch | ✓ | |
| `agent_run_step` capture | ✓ | |
| Trace viewer | ✓ | |
| Per-agent sampling DB row | ✓ | |
| Daily cap enforcement | ✓ | |
| Pass-rate / cost / latency dashboard | ✓ | |
| Regression flag (auto-detect) | ✓ (simple threshold) | Statistical (CUSUM / etc) |
| Auto-pause sampling on regression | | ✓ |
| Slack/email alerts | | ✓ |
| OTEL export | | ✓ |
| ml_engineer RBAC role | | ✓ |
| Cross-product evals (claims, schemes) | | ✓ as those agents ship |

---

## 11. Success Metrics

- **Time-to-root-cause** for a user-reported bad output: < 5 min (from `/analyses/[id]` to identified offending LLM call in trace)
- **Regression catch rate**: ≥ 80% of prompt edits that drop pass-rate >10pp are caught before merge to main (measured by post-mortem retrospective)
- **Eval coverage**: ≥ 50 enabled golden cases per Phase-1 agent within 4 weeks of launch
- **Sampling cost adherence**: 0 days of budget overrun (hard cap should make this trivially true)
- **Dashboard freshness**: pass-rate / cost numbers no more than 5 min stale

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Synthetic PDFs don't reflect real-world weirdness → false confidence | Keep curated redacted-real PDFs as fast-follow track; track pass-rate gap between synthetic-set and prod-sampled judge runs as a divergence signal |
| `agent_run_step` storage cost balloons with prompt+completion text | Enforce 50 KB cap per field; truncate w/ marker. Drop steps older than 90 days (DPDP retention parity). |
| PII leak in trace viewer | All step rows use existing `redactForModelContext` before persistence — never store raw user text. Admin role only. Audit log every trace view. |
| Daily-cap counter race-conditions across concurrent prod requests | Use Postgres `UPDATE ... RETURNING` with conditional `WHERE spend_today_paise + estimated < daily_cap_paise`. If row not returned, skip sample. |
| Trigger.dev task fails mid-batch | `eval_batch_run.status = 'failed'`, completed_cases reflects partial work, admin can resume by clicking "Run remaining" — only re-runs cases with no `eval_run` row for this batch |
| Playwright in Vercel function exceeds memory | Run PDF generation only inside Trigger.dev tasks (Vercel only does parameter validation + enqueue) |
| Synthetic templates drift from real insurer templates over time | Quarterly review SOP — compare a sample of 20 real policies against templates; bump template versions when shapes change materially |
| Admin-only RBAC blocks the QA workflow | Tight Day 1; revisit at Week 4. If QA ramps before then, fast-follow `ml_engineer` role. |

---

## Decision Log

- **2026-04-25** — Module location: extend `/evals` hub AND mirror filtered view at `/products/policy-health-score/evals`. Single component tree, route-level filter.
- **2026-04-25** — Synthetic PDFs: Template + Faker generator (3 health-insurer-shaped templates Day 1, deterministic via seed). Curated redacted real PDFs deferred to fast-follow.
- **2026-04-25** — Tracing depth: Full LLM-call + tool-call trace via new `agent_run_step` table. Hierarchical timeline UI.
- **2026-04-25** — Prod sampling: DB row per agent (`eval_sampling_policy`), admin-editable rate %, hard daily cap. Env var becomes fallback only.
- **2026-04-25** — Batch execution: Per-case sync inline; full-dataset async via Trigger.dev with progress + cancel + pre-flight cost estimate.
- **2026-04-25** — Cost guardrails: Daily cost ceiling per agent, enforced by sampler + by batch pre-flight. Other guardrails (pre-flight confirm, monthly alert, auto-pause on regression) deferred to fast-follow.
- **2026-04-25** — Insurance lines Day 1: Health (individual + family) only. Term-life and motor are fast-follow when those agents exist.
- **2026-04-25** — RBAC Day 1: admin role only. Other roles 403. `ml_engineer` role deferred to fast-follow.
- **2026-04-25** — Scalability is a load-bearing constraint, not a non-functional nice-to-have: Eval Lab must be agent-slug-driven end-to-end so a new product line plugs in via config + templates, not UI edits. Reusable parts live in `packages/eval-lab`. (See §5b.)
- **2026-04-25** — Bulk-approved defaults: 90d trace retention; 10pp regression threshold; ₹100 batch cost-confirm; ₹500/agent default daily cap; 5 cases/batch concurrency; "View trace" button on `/analyses/[id]`; `trace_view_audit` table writes on every trace view.

---

## Resolved Defaults (Decided 2026-04-25, bulk-approved)

1. **Trace retention period:** 90 days (matches DPDP session-log retention). `agent_run_step` rows older than 90d purged by daily cron.
2. **Regression flag threshold:** pass-rate drop > 10pp vs prior 7-day window flags the agent tile red on the dashboard.
3. **Batch pre-flight cost-confirm threshold:** ₹100. Estimates above this require an explicit modal confirm before enqueue.
4. **Default daily cap per agent:** ₹500/agent in `eval_sampling_policy.daily_cap_paise` (50000 paise). Admin-editable per row.
5. **Trigger.dev batch concurrency:** 5 cases in flight per batch. Tunable via `EVAL_BATCH_CONCURRENCY` env var.
6. **Cross-link from `/analyses/[id]` → trace:** small "View trace" button adjacent to existing run metadata in the admin analysis detail page.
7. **Trace-view audit log:** new `trace_view_audit (id, admin_id, agent_run_id, viewed_at)` table. Every `/evals/traces/[agentRunId]` GET writes one row.

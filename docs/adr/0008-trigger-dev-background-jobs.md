# ADR 0008 — Trigger.dev for the analyse pipeline (and future background jobs)

- **Status:** Accepted
- **Date:** 2026-05-19
- **Supersedes:** —
- **Amends:** ADR 0001 stack choice (locks in Trigger.dev as the background-job runtime; CLAUDE.md §3 already named it provisionally)

## Context

The analyse pipeline does ~30–120 seconds of work per upload: OCR (vision pass over the PDF), then 3–5 LLM agent runs (extractor, coverage, scorer, optional translator + reviewer), then DB persistence. We tried two cheaper architectures first; both failed in prod:

1. **Detached promise inside a Server Action** (`void runAnalysisPipeline(...)`). Works locally because the Node process keeps running. Fails on Vercel: the moment the action returns, Vercel freezes the function instance and the detached promise dies mid-execution with **no log line at all** — users see "stuck on Reading every page" forever.

2. **`after()` + `maxDuration = 60`** (Next.js 15 + Vercel Pro). Keeps the function alive until the wrapped work resolves, capped at 60 seconds. Demonstrably works for small PDFs. **Hard 60s ceiling** — bigger PDFs hit `Vercel Runtime Timeout Error: Task timed out after 60 seconds`, confirmed in prod 2026-05-18. The ceiling is a Vercel platform limit; no plan tier removes it for inline serverless work.

So we need durable background execution that:

- Survives Vercel function lifecycles (work continues even after the HTTP response is sent)
- Runs for at least several minutes per job (some PDFs + slow Anthropic responses combined will exceed 60s easily)
- Has retry / idempotency primitives so a transient OCR failure doesn't strand an analysis row in `ocr_running`
- Fits the existing stack (TypeScript end-to-end, deployed alongside the Next.js app)
- Costs $0 for MVP volume

## Decision

Use **Trigger.dev v3** for the analyse pipeline and as the default home for any future multi-minute or scheduled background work in the project.

The Server Action's responsibilities collapse to:

1. Persist the analysis row (`status='queued'`) and upload the PDF to Supabase Storage (unchanged)
2. Enqueue a Trigger.dev task with `{ analysisId }`
3. Return `{ ok: true, analysisId }` to the browser in <1s

A Trigger.dev task (`apps/web-customer/src/trigger/analyse-pipeline.ts`) wraps the existing `runAnalysisPipeline()` and the existing error-classification block (NotAHealthPolicyError / UpstreamUnavailableError / generic). The task gets retries (3 attempts by default, exponential backoff) and a generous per-attempt time budget (15 minutes, far beyond what any real analysis should need). The browser keeps polling the `policy_analysis` row's `status` column exactly as it does today — no UI changes required.

### Trigger.dev environments map to ours

| Trigger.dev env | API key prefix | Used by |
|---|---|---|
| `Development` | `tr_dev_*` | local laptop dev server + Vercel Preview + Vercel Development |
| `Production` | `tr_prod_*` | Vercel Production |

One Trigger.dev project (`surakshasaathi`, ref `proj_afbawgljgtebkvjvpiws`), two env keys. Mirrors how Supabase UAT/prod keys map to Vercel scopes.

### Deploy model

Task definitions live in code (`apps/web-customer/src/trigger/*.ts`). They're pushed to Trigger.dev's cloud via the CLI:

```
npx trigger.dev@latest deploy           # production env
npx trigger.dev@latest deploy --env dev # development env (optional; dev tasks auto-sync via the dev CLI)
```

For prod, `deploy` runs once per change to a task file. Plan to wire this into the prod-deploy workflow once the pattern proves stable; for now it's a manual command after PR merge.

## Why not alternatives?

- **Inngest.** Direct competitor, comparable feature set, similar free tier. Distinguishable only on dev ergonomics. Trigger.dev got the nod because CLAUDE.md §3 already named it and the codebase had env var slots reserved.
- **Supabase Edge Functions + `pg_cron`.** Already in the stack, no new vendor. **150-second execution ceiling** — better than Vercel's 60s but still bumps into our worst-case OCR + agent runs. Plus chaining short Edge Function invocations to fit a multi-step pipeline is doable but adds complexity for no real gain. Revisit only if Trigger.dev costs explode.
- **Self-hosted worker on Fly.io / Render polling a DB queue.** Eliminates external vendor surface entirely. Costs: one more thing to monitor, deploy, scale, and pay for; would absorb engineering time better spent on product. Hold for the day we need worker-level customization Trigger.dev can't give us.
- **Cloudflare Workflows.** Newer, multi-hour durable execution, free tier. Means adopting Cloudflare Workers as a runtime — adds vendor surface, and we're already on Vercel for the web app. Not worth the split.
- **Stay on `after()` + Vercel.** Already proven insufficient in prod 2026-05-18.

## Consequences

**Gained:**
- Analyse pipeline can actually complete in prod for the realistic range of policy PDFs (1–80 pages).
- Retries + idempotency for free — a transient Anthropic 429 no longer maroons an analysis row.
- Trigger.dev dashboard gives per-run logs, traces, and replay — much richer than Vercel function logs for debugging the agent stages.
- The platform is now ready for the next async workload (scheme-match recompute, renewal reminders, deadline watchers, WhatsApp sends — all CLAUDE.md §3 line items) without re-architecting.

**Lost:**
- One more external vendor in the critical path. Trigger.dev outage means analyses queue but don't process. Acceptable: their published SLA is consistent with Vercel/Supabase.
- One more deploy step (`trigger.dev deploy`) before production task changes go live. Documented as a manual step until CI integration.
- Free tier limit (5k runs/month, 1 concurrent execution by default). Watch this and upgrade before MVP traffic hits it.

## Future triggers for revisit

- Sustained >2k analyses/day → upgrade Trigger.dev plan or self-host the runtime.
- Trigger.dev pricing changes that materially affect unit economics.
- Need to extract hot paths to a non-JS runtime (Go OCR, Rust LLM client) → evaluate self-hosted workers at that point.
- Single-tenancy customer demands "no third-party can see our payloads in logs" → self-host Trigger.dev (it's open-source) instead of cloud.

## Execution plan

This PR delivers:

1. This ADR.
2. `@trigger.dev/sdk` added to `apps/web-customer/package.json`.
3. `apps/web-customer/trigger.config.ts` — Trigger.dev v3 project config pointing at `proj_afbawgljgtebkvjvpiws`.
4. `apps/web-customer/src/trigger/analyse-pipeline.ts` — the `analyseTask` definition.
5. `apps/web-customer/src/server/analyse/actions.ts` — replaces `after(() => runAnalysisPipeline(...))` with `await analyseTask.trigger({ analysisId })`.
6. `.env.example` + CLAUDE.md updates documenting the new env vars and decision.

Post-merge requires:
- Three new env vars in Vercel (`TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`, `TRIGGER_API_URL`) per scope.
- Same three vars in local `.env.local`.
- `npx trigger.dev@latest deploy` run once for the Production env.

Tasks NOT in this PR (tracked as follow-ups):
- Wire `trigger.dev deploy` into a GitHub Actions workflow gated on `main` merges that touched `apps/web-customer/src/trigger/`.
- Migrate scheme-match recompute, renewal reminders, and other scheduled jobs to Trigger.dev tasks.
- Add Trigger.dev run IDs to the `agent_run` table so dashboard links surface in admin trace views.

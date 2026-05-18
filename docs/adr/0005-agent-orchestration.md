# ADR 0005 — Agent orchestration: configurable agents with tiered Claude models

- **Status:** Accepted
- **Date:** 2026-04-18

## Context

The platform is multi-agentic by design. Phase 1 agents:

- IntakeAgent — triage user goal + route to a specialist
- DocumentAgent — OCR + structured extraction from policy PDFs, rejection letters, bank statements
- RejectionClassifier (Idea 1) — map rejection letter → IRDAI category → reversal probability
- EscalationDrafter (Ideas 1, 3, 7, 8) — generate grievance, Bima Bharosa, Ombudsman letters
- DeadlineWatcher (Ideas 1, 8) — track IRDAI 14-day and 15-day SLAs, auto-escalate on breach
- MisSellingDetector (Ideas 7, 8) — score ULIP mis-selling from policy + bank statement
- SchemeMatcher (Ideas 3, 7) — map user profile → PM-JAY + state schemes + PMSBY/PMJJBY
- TranslationAgent — insurance-glossary-gated translation (never raw MT)
- ReviewAgent — queue agent output for human review before it reaches a regulator

All 8 idea skeletons and beyond will keep adding agents. Hardcoding each agent's prompt, tools, and model choice would not scale.

## Decision

- An `agent_definition` table stores each agent as a row: slug, name, version, prompt-template (with variables), tool list, model tier, temperature, max tokens, `enabled` flag, `review_required` flag.
- An `agent_run` table stores every execution: input, output, tool calls made, tokens in/out, cost in paise, model used, agent version at time of run, confidence score, user-visible summary. Persisted for audit, replay, and eval.
- Model tiering (hard default in the SDK):
  - **Opus** for high-stakes classifiers and eval agents (RejectionClassifier, MisSellingDetector, ReviewAgent)
  - **Sonnet** for drafters (EscalationDrafter, Scheme explainers)
  - **Haiku** for routing, intake triage, and simple transforms (IntakeAgent, routing decisions)
- **Prompt caching enabled by default** on the system prompt + tool definitions for every agent — these rarely change mid-session and benefit most from caching.
- Every agent invocation is an `agent_run` + (if human review needed) a `review_task` enqueued for admin-portal review.
- Agents can invoke other agents via a registry lookup. Chained calls are linked in `agent_run.parent_run_id` for traceability.
- Admin portal allows: editing an agent's prompt and saving as a new version, running eval datasets, diffing outputs between versions, promoting a version to `production`.

## Consequences

- Adding a new agent for a new idea = one DB row + (if needed) new tool functions + eval data. No deploy.
- Per-case cost is visible (sum of `agent_run.cost`) for every case — enables unit-economics dashboards in the admin portal.
- Every decision that affects a user is replayable for compliance and support.
- We can swap models or providers in one place (the SDK) without touching every agent.

## Non-negotiables

- **ReviewAgent must gate any output that goes to a regulator** (Ombudsman, IRDAI, Banking Ombudsman) until a human has approved. Automating regulatory submissions unchecked is a compliance minefield.
- No agent persists or transmits a user's Aadhaar number without an explicit consent record.
- Prompt caching must not leak user-specific data into cached segments — PII goes in the uncached user message.

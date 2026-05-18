# ADR 0003 — Product-module system: every idea is a config row

- **Status:** Accepted
- **Date:** 2026-04-18

## Context

The platform must carry 8 idea skeletons on Day 1 (Claims Advocacy, Policy Health Score, Govt Scheme Navigator, Family Insurance OS, Vernacular Portal, MSME Navigator, Senior Citizen Portal, Life Mis-selling Recovery) and add new ones (motor claims, crop insurance, travel, cyber) over a 5-year horizon.

If each idea is hardcoded, adding a 9th idea means a new landing-page redesign, a new route tree, and a new deploy. The engineering-instructions doc is explicit: "adding a new product line means adding a card, not redesigning the page."

## Decision

Model every idea as a row in a `product_module` table with columns:

- `id` (stable slug, e.g. `claims-advocacy`)
- `cluster` (enum: `claims`, `advisory`, `new_segment`)
- `name_i18n` (JSONB keyed by locale)
- `tagline_i18n` (JSONB keyed by locale)
- `hero_headline_i18n`, `hero_subhead_i18n`
- `pricing_model` (enum: `free`, `freemium`, `subscription`, `success_fee`, `b2b`)
- `auth_required` (enum: `anonymous`, `registered`, `paid`, `aadhaar_ekyc`)
- `launch_locales` (text[])
- `status` (enum: `concept`, `skeleton`, `beta`, `live`, `deprecated`)
- `landing_route` (e.g. `/claims-recovery`)
- `intake_flow_id` (FK to an intake-flow definition)
- `agent_definition_ids` (text[] of agents this module uses)
- `enabled_for_tenants` (text[] or JSONB)
- Ordering, hero-image CDN URL, etc.

The customer landing page reads `product_module` rows (scoped by tenant + status) and renders the card grid. Adding a new idea = inserting a row + writing an intake flow + registering any new agent definitions. **Zero code changes to the landing page, the router, or the admin portal.**

Agent definitions follow the same pattern (ADR 0005): an `agent_definition` row defines prompt template, tool list, model tier, and version. Intake flows likewise are defined as versioned JSON / DSL rows in an `intake_flow` table.

## Consequences

- Landing page is data-driven. Marketing copy updates don't need engineers.
- Each module can independently progress through `concept → skeleton → beta → live`.
- A/B testing a module's copy, tier, or ordering is a row update + cache invalidation.
- Multi-tenant white-labels can enable/disable modules per tenant via `enabled_for_tenants`.
- Integration tests must cover the generic landing-page / intake-flow renderer, not module-specific code.

## Non-goals

- This is not a CMS. We don't model arbitrary page content — only the known shape of a product module.
- Module-specific backend logic (e.g. the Claims-Advocacy escalation drafter) still lives in code. The module system routes users in and surfaces metadata; domain logic is still TypeScript.

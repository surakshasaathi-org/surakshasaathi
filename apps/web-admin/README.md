# @suraksha/web-admin

Admin portal — operations team only. Hosted at `admin.surakshasaathi.com` (production). `noindex, nofollow`.

## Sections

- **Overview** — live KPIs (open cases, SLA breaches, agent spend, success fees)
- **Case queue** — every case across every module; filter by status, insurer, assignee
- **Reviews** — human-in-loop queue for agent outputs flagged `reviewRequired`
- **Schemes** — versioned PM-JAY / PMSBY / PMJJBY / 20+ state schemes; editor in Week-3
- **Product modules** — the 8 verticals; toggle `status`, edit hero copy, swap intake flows
- **Agents** — registry + prompt editor; insert new versions, promote to default, diff outputs
- **Feature flags** — per-tenant / per-role / per-user evaluation
- **Users & roles** — invite, manage RBAC
- **DPDP requests** — access/erasure/correction queue, 72h SLA
- **Audit log** — super_admin only
- **Settings** — payment, WhatsApp, Trigger.dev, FX rate

## Auth

Admin sign-in uses Supabase magic-link (email). The `sign-in` page exists as a placeholder —
the real flow + API route lands in Week 1 Day 4.

Every page calls `requireAdminSession(allowedRoles)` which:
1. verifies a Supabase session exists
2. loads the caller's membership row
3. redirects to `/sign-in` or `/403` on failure

## RBAC roles

- `super_admin` — everything; rotate secrets
- `admin` — tenant-scoped admin; all ops
- `case_manager` — case queue + reviews
- `content_editor` — schemes, modules, agent prompts
- `cx_agent` — lives in the Support portal, read-only visibility here
- `reviewer` — external (legal, language) reviewer with comment access
- `viewer` — read-only

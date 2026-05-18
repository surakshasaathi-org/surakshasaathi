# ADR 0002 — Advisory-only business posture; no IRDAI broker license (for now)

- **Status:** Accepted
- **Date:** 2026-04-18

## Context

The strategy doc originally proposed applying for an IRDAI composite broker license in Month 3–6 to enable broker-commission revenue across Ideas 2, 4, 5, 6, 7. At kickoff the founder elected to defer the license and operate purely as an advisory / information / document-preparation service.

## Decision

- Do **not** pursue an IRDAI broker license at this time.
- Operate as an "information and document preparation service" — the same regulatory gray zone Insurance Samadhan has occupied for 7 years.
- Revenue = subscription + success fees (on recovery) + affiliate referrals (leads to insurers' own websites).
- No direct policy placement. If a user wants to buy or renew a policy, we send them to the insurer's own site via an affiliate link; we never handle premium payments.
- Govt scheme eligibility check remains always free and anonymous (product principle, unchanged).

## Consequences

- Ideas 2, 4, 5, 6, 7 lose their broker-commission revenue stream. Subscription and affiliate carry them.
- Idea 5 (Vernacular Portal) and Idea 6 (MSME Navigator) are economically thinner than originally modelled; scope or sequencing may be revisited.
- The platform architecture still supports placement — the `broker_placement` table and affiliate-link tracking remain in the schema — so a license-enabled pivot later is a configuration change, not a re-architecture.
- Regulatory exposure is lower: we never take premium money or touch policy-purchase flow.

## Future triggers for revisit

- Monthly subscription + success-fee MRR plateaus below projections and broker commissions would clearly unblock growth.
- An insurer partnership becomes strategically valuable enough that licensure is the price of admission.
- IRDAI regulatory stance tightens against advisory-only models and forces licensure.

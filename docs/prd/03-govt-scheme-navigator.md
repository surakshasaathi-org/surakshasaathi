# PRD — Govt Scheme Navigator (Idea 3)

> Living document. Built checkpoint-by-checkpoint in session. Each section cites the date it was decided and the rationale. When a decision changes, strike the old line with ~~strike~~ and add a new one below with the new date.

- **Module slug:** `govt-scheme-navigator`
- **Landing route:** `/govt-scheme-navigator`
- **Status (per CLAUDE.md):** beta skeleton Day-1, full backend in Phase 1
- **Non-negotiable:** Eligibility check is **always free, anonymous, no-login** (CLAUDE.md §5 + ADR-0002)
- **Tagline:** "The government built the safety net. We built the door."

## Source data

Comprehensive scheme data (7 central + 14 state schemes, eligibility rules, channels, helplines) is in `packages/db/src/seed/data/schemes.ts`. Source: `docs/GOVT_SCHEME_REFERENCE.md` (April 2026).

Key market facts informing the product:
- 12 crore families PM-JAY eligible; 36.9 crore Ayushman cards issued (March 2025)
- ~30–40% eligible-but-unenrolled gap (BCG study)
- Awareness vs enrollment: 70% aware, only 16% enrolled (PMJAY survey)
- ₹14,000 crore unclaimed across life/health schemes
- 70+ auto-eligible since Oct 2024 — 47 lakh Vaya Vandana cards issued by Feb 2025
- 31,140 empanelled hospitals; cashless settlement, patient pays ₹0 when working correctly
- PMJJBY has NO policy document — primary driver of unclaimed death benefits
- Four distinct claim scenarios per ref doc §4: (a) eligibility-on-the-fly at hospital, (b) hospital-refuses-PM-JAY escalation, (c) unclaimed PMJJBY/PMSBY recovery, (d) guided enrolment

---

## Decisions

### 1. Primary user intents & flows

**Decided 2026-04-18.**

Phase 1 MVP ships 4 flows, split into 2 interactive and 2 self-serve guide:

| # | Flow | Phase 1 shape | Rationale |
|---|---|---|---|
| 1 | **Discovery — "What schemes do I qualify for?"** | Interactive, free, anonymous eligibility check (5–7 inputs → full entitlement stack) | Widest top-of-funnel. SEO + WhatsApp-share engine. |
| 2 | **Enrolment walkthrough — "How do I get the card?"** | Interactive guided flow per scheme: document checklist, channel selector (CSC / bank / online portal), eKYC-failure troubleshooting | Converts Discovery signal into action. First paid tier (₹299 assisted enrolment) attaches here. |
| 3 | **Hospital refusal — "They won't honor my PM-JAY card"** | **Static self-serve guide** in all 3 launch locales. Covers: what to say, the 14555 script, how to get written refusal, how to file CGRMS, DGNO/SGRC escalation ladder. No case intake. | User can act on their own. No case management overhead for Phase 1. Reassess Month 3+. |
| 4 | **Unclaimed PMJJBY/PMSBY recovery — "Did my late family member have cover?"** | **Static self-serve guide**: how to check bank statement for ₹436/₹20 debits, how to ask the bank for insurer details, how to download and submit the claim form, what to do if no nominee was registered. No case intake. | Same rationale — content first, agent-driven recovery deferred. Revisit once Discovery + Enrolment flywheel is proven. |

Non-goals for Phase 1:
- Active case management on refusal / unclaimed (success-fee recovery flow lives in Idea-1/Idea-8 infrastructure and is not wired to Scheme Navigator in Phase 1).
- Filing any regulator complaint on the user's behalf.
- Aadhaar-gated enrolment (we give the walkthrough; the user completes it on NHA / bank portal).

### 2. Personas / who the UI serves

**Decided 2026-04-18.**

Phase 1 MVP serves TWO user-input models, toggleable within the same form:

- **Self-check** — user answers for themselves. Default mode. Expected to cover ~60% of Discovery traffic (single-person curiosity, SEO landings, WhatsApp-share opens).
- **Family-check** — user adds household members (self + spouse + parents + kids). Critical because (a) PM-JAY is a family-floater, (b) Vaya Vandana adds a parent-specific 70+ stack, (c) the "adult child in Bengaluru checking for parents in Tier-2" persona is called out explicitly in the strategy doc. Expected ~40% of Discovery traffic but much higher conversion into Enrolment walkthrough.

Single form with a "who are you checking for?" toggle at the top. Default is "Just me". Toggle to "Me + my family" reveals a household-builder.

**Out of scope for Phase 1 (explicit):**
- NGO/SHG worker bulk-check mode — Phase 2 once B2B partnerships sign.
- Hospital/CSC kiosk mode — Phase 2+.

### 3. User journey (per flow)

**Flow 1 — Discovery (interactive, free, anonymous)**
1. User lands on `/govt-scheme-navigator` — from Google, from a WhatsApp share, from the homepage card, or from the FAQ chatbot on another module.
2. Hero + single CTA: "Check my eligibility — free, anonymous, 2 minutes."
3. Single-page form, 6 household-level inputs. Toggle "Me + my family" reveals the relation-driven household builder.
4. User submits → rule-engine runs against every scheme (central + state + senior) → results page renders, grouped by person.
5. User explores results: taps `Tell me more` on a scheme → Scheme Explainer agent writes 3–6 sentences in their locale. Or taps `Ask SurakshaSaathi` → floating FAQ chatbot.
6. User shares on WhatsApp → encoded URL reopens the results without PII.
7. User clicks `Start enrolment` on any eligible scheme → enters flow 2.

**Flow 2 — Enrolment walkthrough (interactive, free, anonymous, content-only)**
1. User arrives on the scheme detail page (from Discovery results, from Google, or direct URL).
2. Sections 5 (How to enrol) + 6 (Documents) + 10 (Contacts) are the action nucleus.
3. Section 5 shows a **channel selector**: "Online (beneficiary.nha.gov.in) / CSC visit / Bank branch / SMS 14555". User taps their preferred channel → sees step-by-step for that channel, localised.
4. Section 6 shows a printable / WhatsApp-shareable document checklist.
5. Section 5 also surfaces **eKYC-failure troubleshooting** for online enrolment ("mobile not linked to Aadhaar?", "name mismatch?").
6. Section 10 surfaces helpline numbers + the direct official-portal link.
7. CTA throughout: deep-link to the official portal. No in-product form filling.

**Flow 3 — Hospital refusal (static self-serve guide)**
1. User lands from Discovery results, scheme page section 9, or a Google search for "hospital refused PM-JAY".
2. Single page, 4 clear steps:
   - Step 1 — Call 14555 right now (localised script ready to read aloud)
   - Step 2 — Get the refusal in writing from the hospital (exact wording to demand)
   - Step 3 — File CGRMS grievance online (beneficiary.nha.gov.in deep-link) — required fields + sample text
   - Step 4 — Escalate to DGNO → SGRC → NGRC if not resolved in 15 days (contact table per state)
3. CTA at bottom: "Still stuck? Call 14555" — no case intake, no handoff to us in Phase 1.

**Flow 4 — Unclaimed PMJJBY/PMSBY recovery (static self-serve guide)**
1. User lands from a Discovery result ("possibly-eligible due to deceased family member"), scheme page section 9, or direct search.
2. Single page, 5 steps:
   - Step 1 — Open the deceased's bank statement, look for ₹436 (PMJJBY) or ₹20 (PMSBY) annual debit in May/June
   - Step 2 — Go to the same bank branch; ask for the insurer name + policy reference
   - Step 3 — Download the claim form from jansuraksha.gov.in; checklist shown on-page
   - Step 4 — Submit at the bank within 30 days of death (or ASAP if beyond)
   - Step 5 — If no nominee was registered — legal heir / succession certificate path
3. Edge-case callouts: post-office accounts (CPRC Chennai), missing death certificate, multi-account holders.
4. CTA at bottom: "Still stuck? Call CPGRAMS or bank" — no case intake in Phase 1.

### 4. Feature list

**Decided 2026-04-18.** MVP scope is comprehensive — the product is the authoritative Indian gov-scheme encyclopaedia + eligibility tool, in 3 languages at launch.

**Phase 1 MVP ships:**
1. **Discovery — eligibility check** (flow #1): self + family, 6 household-level + per-person fields, results page grouped by person.
2. **Enrolment walkthrough** (flow #2): free, content-only, per-scheme pages with channel selector + document checklist + eKYC-failure troubleshooting.
3. **Hospital-refusal self-serve guide** (flow #3): static, 3 languages, covers 14555 script / written refusal / CGRMS / DGNO/SGRC/NGRC escalation ladder.
4. **Unclaimed PMJJBY/PMSBY recovery self-serve guide** (flow #4): static, 3 languages, covers bank-statement check / insurer identification / claim-form submission / no-nominee edge case.
5. **Scheme detail pages** — one per scheme (21 at launch), each with the standard 10-section template (see checkpoint 4a).
6. **Hospital / network list per scheme** (depth per checkpoint 4b).
7. **WhatsApp share** for results and scheme detail pages.
8. **Floating FAQ chatbot** grounded in scheme DB, glossary, and hospital network (Sonnet, aggressive prompt caching).
9. **Scheme Explainer agent** — "tell me more" button on each result card (Sonnet).
10. **Language toggle** — English / Hindi / Kannada throughout; Tamil/Telugu/Bengali fast-follow.
11. **Admin console** — content editor for schemes, hospitals, guides, agent prompts; role: `content_editor`.

**Fast-follow (Phase 2):**
- Assisted enrolment tier (₹299 concierge) — phone-OTP + scheduled WhatsApp/video call.
- Voice input on eligibility form (Web Speech API).
- Active case management for hospital-refusal and unclaimed-recovery (reuses Claims Advocacy infrastructure).
- NHA SECC lookup API / ABHA linking (requires partnership + Aadhaar flow).
- NGO / SHG / CSC B2B dashboard.

### 4a. Scheme detail page structure

**Decided 2026-04-18.** Ten-section template, identical order across all 21 schemes:

1. **Overview** — one paragraph: what it is, who runs it, why it exists, launched when
2. **Who qualifies** — eligibility in plain language; ends with "Try the 2-minute eligibility check →"
3. **What's covered** — procedure / benefit list (expandable), including auto-enrolment notes (e.g. 70+ under Vaya Vandana)
4. **What's NOT covered** — explicit exclusions (OPD for PM-JAY, natural death for PMSBY, etc.) — one of the highest-value sections, users are constantly surprised
5. **How to enrol** — channel selector (online portal / CSC / bank / SMS / employer) with step-by-step per channel + eKYC-failure troubleshooting
6. **Documents you'll need** — printable / WhatsApp-shareable checklist
7. **Hospital / bank network** — deep-link to official search (per 4b)
8. **How claims work** — step-by-step from admission to settlement; mentions SLA ("IRDAI 14 days for grievance response"); emergency-mode handling
9. **If your claim is rejected** — links to the Hospital-refusal guide (flow 3) or Unclaimed-recovery guide (flow 4) as relevant; also the insurer grievance → Ombudsman escalation path
10. **Contacts, helplines & official portals** — phone / email / portal tables; "last verified" timestamp

Per-section editorial rules:
- Every section can be independently translated + independently re-verified; a section can be marked stale without invalidating the page.
- Sections link to the glossary inline for any regulated term.
- Sections never contradict the scheme's official-portal content. "Last verified by editorial team" visible publicly.

### 4b. Hospital / network data

**Decided 2026-04-18.** Deep-link to official searches in MVP. We do NOT ingest the 31,140-hospital PM-JAY list ourselves.

UI: compact "Find a hospital / bank" widget in section 7 of every health/life scheme page.
- Health schemes: state + city → opens `pmjay.gov.in/hospitals` (PM-JAY/Vaya Vandana), state SHA portal (state schemes), `cghs.mohfw.gov.in/empanelled-hospitals` (CGHS), ESI dispensary locator, ECHS polyclinic locator.
- Life/accident schemes: scheme explains "PMJJBY/PMSBY is administered by your bank — there's no hospital network. Your bank branch IS the interface." No widget, just content.

Crowdsourced "this hospital refused to honor the scheme" report form deferred to Phase 2 (moderation + verification team needed first).

### 5. Inputs we collect

**Decided 2026-04-18 (Self-check core set).**

Household-level inputs, asked once per check:

| Field | Required | Why it's here | Why it's not more |
|---|---|---|---|
| State | ✓ | Every state-scheme match needs this; also drives local scheme DB call. | Non-negotiable. |
| Annual household income band | ✓ | Bands: `< ₹1.2L`, `₹1.2–5L`, `₹5–10L`, `> ₹10L`. Differentiates CMCHIS (<₹1.2L), Aarogyasri AP (<₹5L), Karunya KASP (<₹3L). | Ranges not exact rupee figures — less invasive, same match precision. |
| Occupation category | optional | Maps to PM-JAY urban-11-categories (construction, domestic, security, etc.) and flags farmer / ex-serviceman / central-govt routes. ~12 grouped options, not 20+. | Users skip → scheme match downgrades to 'possibly eligible' instead of failing outright. |
| Ration card colour (yellow/pink/white/none) | optional | The cleanest BPL proxy without asking SECC category names. Yellow ≈ AAY, Pink ≈ BPL, White ≈ APL, None ≈ unknown. | We don't ask SECC deprivation codes D1–D7 directly — users don't know them. |
| Has a savings bank account | ✓ | PMSBY/PMJJBY gate. Also opens Jan Suraksha path to PM-JAY discovery via account-linked mobile. | Yes/no only — account number never collected. |
| Age | ✓ | Drives PMSBY (18–70), PMJJBY (18–50), Vaya Vandana (70+). | DOB not required — year-of-birth sufficient. |

**Aadhaar is never asked.** We tell the user at enrolment time which portal needs it and how to proceed. (CLAUDE.md §6: Aadhaar only for high-value financial actions.)

**No PII stored on anonymous checks.** Inputs drop out of memory when the result page closes; only an anonymised aggregate event (state, age-band, income-band, scheme matches returned) goes to analytics.

### 5a. Family-check household model

**Decided 2026-04-18.** Relation-driven rows.

Per-person row inputs:
- **Relation** — self / spouse / father / mother / child / other (grandparent, sibling, dependant)
- **Age** — year of birth OK
- **Occupation** — same dropdown as self-check; children hide this
- **Has own bank account** — yes/no (unlocks PMSBY/PMJJBY per-person)

Per-person optional flags (collapsed behind "advanced"):
- Has a disability (maps PM-JAY D4)
- Pensioner / ex-serviceman (CGHS / ECHS / Vaya Vandana routing)

Household-wide optional flags asked once at the top of the household builder:
- Women-headed household (no adult male 16–59) — PM-JAY D3 signal
- Single-room kucha house — PM-JAY D1 signal
- Manual scavenger / bonded labourer / primitive tribal group — PM-JAY auto-include

No names, no Aadhaar, no PAN, no phone-per-member collected at Discovery. These arrive only if the user continues into Enrolment.

### 6. Outputs we produce

**Decided 2026-04-18.** Results page organised by person.

Grouping hierarchy:
1. **For you (self)** — user's matches
2. **For each named household member** — named rows ("For your father, 72") — order by oldest first so senior-specific auto-enrolments (Vaya Vandana, PM-JAY 70+) surface
3. **For your whole household** — family-floater + household-eligibility schemes (PM-JAY SECC, state schemes with household income cap)

Within each group, schemes sort by:
1. Green `✅` auto-eligible first (highest-confidence, highest-coverage first)
2. Amber `⚠` possibly-eligible second (confidence-ranked)
3. Red `❌` not-eligible collapsed behind "Why I don't qualify" disclosure

Per-scheme card surfaces (all locales):
- Scheme name + 1-line what-it-covers
- **Why you qualify** — quoted from the eligibility rule ("You're 72, so you automatically qualify since October 2024")
- Coverage amount in ₹
- Whose benefit (this row's person)
- **Primary CTA**: `Start enrolment →` (flow #2) if enrolable by user; `Already yours — here's your next step` for auto-issued
- Secondary: `Read full guide` → per-scheme detail page; `Share on WhatsApp` → pre-composed message with no PII
- Fine print: helpline number, official portal URL, estimated time-to-card

Negative matches ("why I don't qualify") are shown only on request. We never open with a rejection.

**No persistence of inputs for anonymous Discovery.** The results page is shareable by URL only via a signed, non-identifying token that encodes the form state (no PII → nothing sensitive in the URL).

### 7. Agents + tools

**Decided 2026-04-18.**

Core matching is **NOT an agent** — it's a deterministic JSON-DSL rule evaluator in TypeScript. Zero LLM cost, zero hallucination risk on regulated eligibility. "Why you qualify" sentences are templated per locale per rule outcome.

Two LLM agents add value on top:

**1. Scheme Explainer (Sonnet)** — triggered by `Tell me more / Explain simply` button on a scheme card.
- Inputs: scheme record (from DB), user's locale, user's inputs (state, age-band, occupation, household composition — all anonymous)
- Tools: `lookup_scheme`, `lookup_glossary` (insurance-term glossary is the source of truth for terminology translations — no free-form machine translation)
- Output: 3–6 sentences in the user's locale, grounded in scheme record. Covers "what this covers in plain language" + "what you'd typically do next". Follows the 5-section template from the seed (what covers / what doesn't / how to enrol / what to bring / what if hospital refuses).
- `reviewRequired: false` — read-only; doesn't affect user action.

**2. FAQ Chatbot (Sonnet)** — floating `Ask SurakshaSaathi` widget on the results page + every content page.
- Inputs: user's question (typed or voice via Web Speech API), current page context (scheme in view, state, etc.), conversation history
- Tools: `lookup_scheme`, `lookup_glossary`, `list_state_schemes`, `list_empanelled_hospitals` (scoped query — network lookup by city or pincode)
- Output: grounded answer; declines to answer out-of-scope questions with a polite redirect to 14555 / CPGRAMS.
- Aggressive prompt caching on the system prompt + scheme DB snapshot (refreshed hourly).
- `reviewRequired: false` for read-only queries. For any query that would draft a complaint letter or escalation, route to `escalation-drafter` which IS review-required. (Cross-product: same agent powers Claims Advocacy in flows 3 & 4 when they become active.)

Both agents must be **clearly labelled** as AI assistants. User-facing copy: "AI assistant — verify important details on the official portal before acting."

**Out of scope for MVP:**
- Natural-language / voice input for the eligibility form (Phase 2 if WhatsApp uptake demands it).
- Any agent that takes an action on behalf of the user — all Discovery/Enrolment is self-serve; user visits the portal themselves.

### 8. Integration points

**Decided 2026-04-18.** Zero external API integrations for MVP.

- **Scheme data:** self-hosted in Postgres (seeded from `packages/db/src/seed/data/schemes.ts`). Versioned rows. Content team updates via admin portal.
- **Every CTA deep-links to the official portal** for the action (beneficiary.nha.gov.in, jansuraksha.gov.in, state SHA portals, CPGRAMS, CGRMS). Users transact on official rails — we just get them there.
- **WhatsApp share** uses a client-side `web+whatsapp:` URL with a pre-composed, locale-appropriate message and a signed, non-identifying token that rehydrates the result set without PII.

Deferred to Phase 2+:
- NHA SECC lookup (beneficiary.nha.gov.in eligibility API) — only revisit when (a) a paid Assisted Enrolment tier is worth the Aadhaar handling, and (b) we have formal NHA access.
- MyScheme feed — to auto-catch scheme drift.
- ABDM ABHA linking.
- Jan Suraksha claim-form auto-fill.

### 8. Integration points

_To be decided._

### 9. Monetization

**Decided 2026-04-18.**

**Phase 1 MVP of the Scheme Navigator is 100% free.** No tier, no paid upsell, no gating.

Rationale: user chose content-only enrolment; deferring the ₹299 assisted-enrolment concierge pushes first revenue for this module to Phase 2. The product is pure top-of-funnel in Phase 1 — its job is brand, SEO, and WhatsApp virality, not MRR.

Revenue streams held in reserve for Phase 2+ (only when demand signal proves them out):
- **Assisted enrolment** — ₹299 concierge (WhatsApp/video call, trained advisor)
- **Unclaimed recovery success fee** — once we switch flow #4 from static guide to active case
- **Hospital-refusal success fee / retainer** — once we switch flow #3 from static guide to active case
- **B2B SaaS** — NGO / SHG / CSC operator dashboards (₹5k–20k/month)
- **State-government partnerships** — fee-for-service API or licensed UI (political TAM exists per ref doc + "Your Money, Your Right" initiative)

Affiliate referrals and broker commissions do NOT apply here — all schemes are government, not insurer products. No intermediation possible.

### 10. MVP cut vs. fast-follow — consolidated

**In Phase 1 MVP (ships Day 1):**
- Discovery — 6-field eligibility form (self + family); rule-engine match against 21 schemes
- Grouped-by-person results page + Scheme Explainer agent on each card
- FAQ chatbot floating on results + scheme detail pages
- Enrolment walkthrough (flow 2) — per-scheme, content-only, channel-selector-based
- Hospital-refusal static guide (flow 3) — 3 languages
- Unclaimed PMJJBY/PMSBY recovery static guide (flow 4) — 3 languages
- 21 scheme detail pages × 10-section template × 3 locales (AI-drafted → human-reviewed pipeline)
- Hospital / bank network via deep-link to official portals
- WhatsApp share on all share-worthy pages
- Admin content editor — schemes, sections, hospitals, guides, agent prompts
- Editorial "last verified" timestamp on every section + >6mo staleness cron

**Fast-follow (Phase 2, after MVP proof signals):**
- Assisted enrolment tier — ₹299 concierge call (phone-OTP + WhatsApp/video + scheduling)
- Active case management for hospital refusal — reuses Claims-Advocacy infra
- Active case management for unclaimed PMJJBY/PMSBY recovery — success-fee revenue
- Voice input on the eligibility form (Sarvam AI for Indian langs)
- Ingested hospital search index (partial — top N per launch city)
- NGO / SHG / CSC B2B dashboard
- NHA SECC lookup (opt-in, only if Assisted tier ships + API access secured)
- Tamil / Telugu / Bengali launch (4 locales → 7 locales)
- Crowdsourced "hospital refused" reports with moderation
- Partnership content from MyScheme / NHA (licensing)
- State-government partnership SKU (fee-for-service)

### 11. Success metrics

Strategy-doc North Star: "Families enrolled in a scheme they didn't know they had."

Baseline targets from strategy doc:
- Month 1: complete scheme DB for 5 states (MH, KA, TN, WB, UP); 1,000 eligibility checks/week via WhatsApp
- Month 3: ₹3L MRR (200 assisted enrollments + 10 unclaimed recoveries)
- Month 6: ₹12L MRR (volume + 2 NGO/CSC B2B contracts)
- Month 12: ₹30L MRR, 50,000 checks/month

**Decided 2026-04-18.**

**North Star:** Families enrolled in a scheme they didn't know they had. Measured by Discovery → Enrolment-page click → (manual follow-up survey) "did you enrol?" conversion.

**Leading indicators (instrumented Day 1):**
- Eligibility checks completed per week (goal Month 1: 1,000/week from WhatsApp groups; Month 12: ~12,500/week / 50,000/month)
- % of checks that return at least 1 green ✅ match (health of the scheme DB — dips signal data gaps)
- % of results pages that click into a scheme detail page (result quality proxy)
- % of scheme-detail-page sessions that click an Enrolment CTA (intent-to-act proxy)
- WhatsApp-share rate per results page (virality proxy)
- Scheme-explainer agent invocations + satisfaction (thumbs-up/down)
- FAQ chatbot questions answered vs deflected to 14555/CPGRAMS
- Language mix (EN/HI/KN) — gate for Tamil/Telugu/Bengali rollout

**Lagging indicators (reviewed monthly):**
- Staleness debt: % of scheme sections >6 months since last verify
- Content pipeline throughput: sections drafted / reviewed / live per week
- User-reported errors per 1,000 checks (quality proxy)

**Strategy-doc targets** (used as the plan-of-record unless revised):
- Month 1: complete scheme DB for 5 states, 1,000 checks/week
- Month 3: ₹3L MRR — NOT from Scheme Nav in this plan (Phase 1 is free); from other modules
- Month 12: 50,000 eligibility checks/month, ₹30L MRR — only reachable if Phase 2 monetization ships on schedule

### 12. Risks & edge cases

**Top risks (with mitigations):**

| Risk | Impact | Mitigation |
|---|---|---|
| Content drift / staleness | Users act on stale rules → harm | Every section has `verifiedAt`; cron flags >6mo; red staleness banner on page if a section is past its verify date |
| LLM hallucination in Scheme Explainer / FAQ chatbot | User acts on a wrong fact | Agents are grounded in scheme DB + glossary via tools; system prompt forbids invention; "AI assistant — verify on official portal" disclaimer; quarterly red-team eval against a fixed question bank |
| Content team can't produce 630 files in time for MVP | Launch slips | Ship Phase 1a with launch locales = English + Hindi ONLY (defer Kannada by 4 weeks) if content throughput is behind |
| Portability confusion (WB Swasthya Sathi, opt-out states) | User travels, scheme doesn't apply, crisis at hospital | Portability warning banner on every state-scheme detail page; flow 3 (hospital refusal) includes the "you're out of state" branch |
| Government rolls out a competitor (Jan Suraksha v2, ABDM UI) | Loss of differentiation | 3–5yr horizon — acceptable risk; our moat is vernacular-first UX + rejection/complaint expertise |
| Ethical: monetizing vulnerable users | Reputation, regulator | Eligibility check non-negotiably free and anonymous; no dark-pattern upsell; concierge is explicit opt-in with clear price |
| Adverse selection via Assisted tier (Phase 2) | Failed enrolments, refund pressure | Only accept cases where eligibility is clearly green; set "partial refund if enrolment fails for reasons outside our control" policy up-front |

**Known edge cases the product handles explicitly:**
- eKYC failure: mobile not linked to Aadhaar, name mismatch, migration-era address mismatch
- 70+ senior with existing CGHS/ECHS/CAPF must choose (per Vaya Vandana rules) — flagged on the result card
- Private-insurance holder stacking with PM-JAY — confirmed allowed; surfaced as a positive
- Deceased-member PMJJBY with no nominee registered — legal-heir path in flow 4
- Post-office PMJJBY accounts — CPRC Chennai routing, different from bank route
- State scheme portability pitfall (WB, OD, pre-2025 Delhi) — warning banner
- Hospital refuses a valid PM-JAY card — IRDAI 1-hour mandate + emergency-mode script in flow 3
- PMSBY non-covered causes (natural death, suicide, alcohol-related) — explicit in scheme page section 4

### 13. Open questions

_Flushed at PRD close 2026-04-18. Move each to its own issue when we start implementing._

- **Who writes + reviews the content?** Need to hire (or contract) 1 English content lead + 1 Hindi reviewer + 1 Kannada reviewer before launch. Not a product-scope question but a hiring blocker for MVP timeline.
- **Staleness cron threshold.** Defaulted to 6 months. Probably too long for PM-JAY (changes quarterly), fine for PMSBY (static). Revisit per-scheme after launch data.
- **WhatsApp-share message wording.** Multiple templates to test — keep in the admin content editor for editorial, not code.
- **Who owns state-scheme expansion after the seeded 14?** Need a state-by-state rollout plan (pick 5 more states for Phase 1.5).
- **Analytics pipeline.** Where does the aggregated / anonymised event stream land? Vercel Analytics for now; PostHog or similar when we need funnel drill-downs.
- **Accessibility.** Screen-reader + keyboard-nav audit before launch — not yet in scope of this PRD.
- **Cost ceiling for the FAQ chatbot.** Abuse risk (someone scripts 100k questions). Rate-limit per IP + per-anonymous-session. Decide caps before launch.

---

## Sign-off

**PRD status:** Sign-off pending. All 12 checkpoint sections filled 2026-04-18 in-session.

When user signs off, this PRD becomes the source of truth for the Scheme Navigator build. Changes go through stricke-through edits with dates, or a new PRD version.

# PRD — Claims Advocacy Portal (Idea 1)

> Living document. Built checkpoint-by-checkpoint. Each decision cites the date and rationale. Strike-through `~~old~~` + new dated line when decisions change.

- **Module slug:** `claims-advocacy`
- **Landing route:** `/claims-advocacy`
- **Status (Day 1):** `beta` (per product_module seed)
- **Taglines (seeded):**
  - _"India's insurance crisis isn't about buying — it's about using"_
  - _"Your claim was rejected. We fight back."_
- **Strategy-doc cluster:** Cluster A — Claims & Recovery

## Source data

- `docs/PRODUCT_STRATEGY.md` Idea 1 section — revenue model, competitive moat, risks, 90-day plan
- `docs/ENGINEERING_INSTRUCTIONS.md` — standard engineering rules (ADR-first, git safety, DPDP, etc.)
- `packages/db/src/seed/agent-definitions.ts` — pre-seeded agents that power this vertical (IntakeAgent, DocumentAgent, RejectionClassifier, EscalationDrafter, DeadlineWatcher, ReviewAgent)
- Market context: 11% official rejection rate, 33% partial approval with questionable reasons, 36% outright rejection per consumer survey; 70% Ombudsman win rate for filed cases; ₹26,000 crore rejected in FY24 (+19.1% YoY); Insurance Samadhan operating this space manually at ~₹6 crore ARR on $5M raised over 7 years; IRDAI Draft Ombudsman Rules 2025 propose 100% penalty on awarded amount for insurer non-compliance.

## Why this product exists

The post-purchase insurance experience in India is broken. Buying works (Policybazaar, insurer apps, agents). **Using** the policy — when you actually need it — is where 36% of consumers face outright rejection and another 33% face partial/questionable approvals. The Ombudsman system works (70% win rate for filed cases) but is opaque to ordinary policyholders. Insurance Samadhan proves the TAM via manual ops; a tech-first platform can 10x the trajectory by compounding data (rejection patterns, insurer × ICD code × reason × winning document).

---

## Decisions

### 1. Primary user intents & flows

**Decided 2026-04-18 (revised mid-session after user pivoted away from case-fighting).**

Phase 1 MVP is **AI-guidance only, not case management.** Two SKUs:

| SKU | Who it's for | What we do | What user does | Price |
|---|---|---|---|---|
| **A1 — Letter-only (AI advisory)** | Anyone whose health insurance claim was rejected in the last 6 months, claim amount < ₹5 lakh | AI classifies the rejection (waiting period / exclusion / documentation / pre-authorisation / non-disclosure / other), computes reversal probability, generates a ready-to-sign grievance letter with correct IRDAI citations, and provides a self-serve Ombudsman escalation guide | Reviews and signs the letter, files it with the insurer grievance cell themselves, tracks their own SLAs, escalates to Bima Bharosa / Ombudsman on their own using our guide | **₹999 flat** upfront |
| **B — Pre-claim Readiness subscription** | Families who want to avoid rejection before they claim | Continuous policy audit: waiting-period check, exclusion-risk map, documentation-gap alerts, Claim Readiness Score 0–100 with specific improvement actions. Gold tier adds quarterly audits + family coverage map | Uploads policies, acts on alerts, renews annually | **Silver ₹499/yr** or **Gold ₹999/yr** per family |

**Deferred to Phase 2+ (explicit):**
- **A2 — Full-case "we fight" SKU** — case intake, filing with insurer on user's behalf, SLA tracking, Ombudsman escalation, case-manager handling, success-fee economics. Postponed indefinitely; user decision was "case fighting can come in later." When it ships, the shared infra (rejection classifier, letter drafter, pattern DB) is already built.
- **C — B2B API / white-label** — HR/corporate dashboard, broker white-label, hospital TPA liaison. Strategy-doc Month 9+.

**Why guidance-only in Phase 1:**
- No case backlog, no 3–4 month Ombudsman timeline to underwrite, no working-capital lock.
- No human-in-loop filings = no human review bottleneck on regulatory outputs.
- Self-serve volume can scale without staffing case managers.
- Still builds the rejection pattern DB (every paid analysis feeds it).
- Strictly advisory posture is lower regulatory risk.

**Trade-off accepted:** Lower ₹/case than A2 (₹999 vs ₹12k–30k projected). Win-rate signal is weaker because we don't see the outcome unless the user tells us. Mitigation: post-filing follow-up survey + offer free re-analysis if the first letter didn't work.

### 2. Personas

**Decided 2026-04-18 (derived from the 2 locked SKUs).**

**SKU A1 primary persona — The Recently-Rejected Policyholder.**
- Urban or semi-urban, 28–55, household income ₹5L–₹40L.
- Their or a family member's health claim was rejected within the last 6 months; amount ₹25k–₹5L.
- Digitally competent: comfortable signing up via phone OTP, uploading a PDF or phone-photo of documents, paying ₹999 via UPI or card.
- Emotional state: frustrated, often angry at the insurer, doesn't know where to escalate.
- Willing to file themselves if they have the RIGHT LETTER with the RIGHT CITATIONS — they don't want hand-holding, they want expert-quality artillery.
- Language mix: English + Hindi + Kannada at launch; letters drafted in English with per-clause Hindi/Kannada plain-language explanation (regulators accept English).
- Discovery: Google, Reddit r/IndiaInvestments, consumer court Facebook groups, LinkedIn insurance communities (per strategy-doc Days 1–30 plan).

**SKU B primary persona — The Proactive Family Planner.**
- 35–50, urban, dual-income, ₹10L–₹40L household.
- 3–6 active policies across family members. Has been burned by a rejection OR knows someone who has.
- Willing to pay ₹499–999/yr to avoid surprises.
- Typically has one "insurance person" in the family — often the adult child or the more-involved spouse.
- Reads annual policy documents infrequently; won't manually check waiting periods.
- Discovery: referral from an A1 user, financial-planning content, own Google search, WhatsApp share.

**Out of persona for MVP:**
- Users with claims > ₹5 lakh (strategy-doc cap).
- Users with claims > 6 months old (adverse selection risk).
- Users with life / motor / travel claim rejections (out of scope; revisit post-MVP).
- Corporate/HR buyers (SKU C deferred).
- Very low digital-literacy users — they're served better via SKU A2 "we fight" when it ships, not self-serve letter-draft.

### 3. User journey (per flow)

**SKU A1 — Letter-only rejection-to-filing (most common flow):**
1. User lands on `/claims-advocacy` — from Google, social, WhatsApp share, home page card.
2. Above-fold CTA: "Analyse my rejection — ₹999" with the sub-lead "We classify the rejection, compute your reversal odds, and draft a legally precise grievance letter."
3. User taps → phone-OTP signup (or sign-in) — minimal friction, no Aadhaar.
4. Intake form (3 steps, each <90s):
   - **Step 1 — Claim basics:** insurer (dropdown of top 30), policy number (optional, helps but not required), claim amount (₹ band), claim-rejected date, brief description (optional).
   - **Step 2 — Documents:** rejection letter (PDF upload or phone photo); policy document (optional but boosts classifier confidence); hospital bill (optional).
   - **Step 3 — Payment:** ₹999 via Razorpay (UPI / card / netbanking / wallet).
5. After payment, case moves to `status: processing`. User sees a progress page: "Analysing your rejection letter… this takes about 5–10 minutes."
6. Background: DocumentAgent OCRs + extracts fields → RejectionClassifier runs (Opus) → EscalationDrafter drafts grievance letter (Sonnet) → ReviewAgent scans the draft for citation errors and tone (Opus) → human content_editor reviews and approves in admin portal (Phase 1 volume is low, manageable).
7. User receives WhatsApp + email notification when ready (typically same day; SLA = 24h for MVP).
8. User returns to case page, which now shows:
   - **Your rejection, analysed** — category + quoted evidence from the letter + reversal probability with confidence
   - **Your grievance letter, ready to sign** — downloadable PDF in English + plain-language summary in chosen locale; editable online before download
   - **What to do next** — step-by-step self-filing guide: send to insurer grievance cell (address pre-filled), wait 14 days, if no response → Bima Bharosa portal with instructions, if still unresolved → Ombudsman filing guide with the template already adapted
   - **Document checklist** — exactly what to attach when filing
9. User files on their own; we provide a follow-up survey ("Did you file? What happened?") at +14 days, +30 days, +60 days, +120 days — powers the win-rate signal + pattern DB updates.
10. Upsell at the 14-day mark if insurer didn't respond: "Want us to draft the Bima Bharosa follow-up?" → flat fee ₹499 for the follow-up letter.

**SKU B — Pre-claim readiness subscription:**
1. User lands from home page, from an A1 upsell after their case closes, or from a family member's referral.
2. CTA: "Check your family's claim readiness — ₹499/yr (Silver) or ₹999/yr (Gold)".
3. Phone-OTP signup → payment → onboarding flow: upload your policies (each member, each policy). Manual PDF upload for MVP.
4. DocumentAgent extracts fields → PolicyHealthScorer agent (Sonnet) + GapFinder agent generate Claim Readiness Score (0–100) per policy + per family + a prioritised action list.
5. User sees a dashboard: scores, gaps, specific actions ("Your father's policy has a 3-year waiting period for diabetes; he was diagnosed 14 months ago; claim readiness on diabetes is 0%; nothing to do except wait; set reminder for 22 more months").
6. Annually (Silver) or quarterly (Gold), we re-run the audit; changes trigger WhatsApp/email alerts.
7. If the user ever hits a claim rejection while subscribed, we offer SKU A1 at a discount (or free, TBD).

### 4. Feature list

**Phase 1 MVP ships:**

**Intake**
- Web intake form (responsive, mobile-first, 375px min) in English + Hindi + Kannada
- WhatsApp intake via WATI — user DMs our number with "rejected claim" trigger → bot collects the 3 steps conversationally → WATI payment link → same backend
- Phone-OTP auth with Aadhaar-free signup
- Razorpay payment for ₹999 one-time (A1) and ₹499 / ₹999 annual (B)

**Document handling**
- PDF + image (JPG/PNG/HEIC) upload with file-type + size validation (<10MB per file)
- Background OCR via DocumentAgent (Sonnet + tool that hits Tesseract/Vision API — vendor decision Phase 2)
- SHA-256 content hashing for dedup + audit
- Supabase Storage (India region) with RLS-enforced access

**Agent pipeline for each A1 case**
- IntakeAgent classifies the request type (Haiku) — guards against users who submit a non-rejection document or pre-claim policy
- DocumentAgent extracts structured fields from rejection letter + policy (Sonnet)
- RejectionClassifier categorises + computes reversal probability (Opus, review-required)
- EscalationDrafter writes the grievance letter (Sonnet, review-required)
- ReviewAgent pre-reviews the draft for citation errors, tone, factual support (Opus)
- Human content_editor approves the draft in admin portal before delivery

**Agent pipeline for each B case**
- DocumentAgent extracts policies (Sonnet)
- PolicyHealthScorer runs the 5-dimension score (Sonnet)
- GapFinder writes actionable alerts (Sonnet)
- No human review required for score outputs (low-stakes); user can always file a correction

**Output deliverables to user**
- A1: rejection analysis + drafted grievance letter (PDF + editable online) + self-filing guide + document checklist + Bima Bharosa + Ombudsman templates
- B: Claim Readiness dashboard (per-policy, per-family, overall) + alert inbox + annual/quarterly re-score reminders

**Case management**
- User-facing case page with timeline of agent + human actions
- Case status: `processing` → `analysis_ready` → `delivered` → `awaiting_user_action` → `follow_up_14d` → `follow_up_30d` → `follow_up_60d` → `closed`
- In Phase 1, we NEVER transition to `filed` / `awaiting_insurer` — those are A2 states, deferred
- Follow-up surveys at the defined intervals (email + WhatsApp) feed win-rate signal

**Admin portal support**
- Case queue for content_editor role — review drafted letters, approve / request-edit / reject
- Rejection pattern DB viewer — insurer × ICD × rejection reason × what the successful letter said
- Agent prompt editor (already scaffolded)
- DPDP request handling (already scaffolded)

**Pattern DB (the compounding data moat)**
- Every approved case writes a structured row: insurer, rejection category, rejection quoted evidence, ICD codes if any, policy type, waiting period in play, amount, user's state, final disposition (from the follow-up survey)
- Admin-only read for content_editor + super_admin roles
- Feeds future agent prompts and MAY become an aggregate public dashboard ("Which insurers reject most on waiting-period grounds") in Phase 2

**Not in MVP (deferred):**
- A2 Full-case flow (case filing on user's behalf, Ombudsman filing, SLA tracking as active cases)
- Hospital TPA liaison
- B2B API
- Life / motor / travel / cyber claim support
- Claims > ₹5 lakh
- Claims > 6 months old
- Voice-note intake (WhatsApp voice notes) — Phase 2
- Insurer-specific deep integration (pre-populating complaint forms on insurer portals)

### 5. Inputs we collect

**A1 intake inputs (required unless marked optional):**
- Phone number (for OTP + WhatsApp follow-up)
- Name (optional — used for letter signature; user can override on the draft)
- Insurer (dropdown of top 30 Indian health insurers + "other")
- Policy number (optional — boosts classifier confidence; user can skip)
- Claim amount (band: <₹25k / ₹25k–50k / 50k–1L / 1L–2L / 2L–5L)
- Claim rejected date
- Brief description (optional, free-text in user's locale — helps classifier)
- Rejection letter (required — PDF or phone photo)
- Policy document (optional — strongly recommended)
- Hospital bill / discharge summary (optional — boosts exclusion/waiting-period analysis)
- Locale preference (EN / HI / KN)

**B intake inputs (on onboarding):**
- Family member list (name, age, relation, policies held)
- Per-policy upload (PDF or photo)
- Known medical conditions (optional, used to score waiting-period exposure)

**Never asked:** Aadhaar, PAN, income proof, bank account details, exact medical records. If we ever do, it's a new consent surface (CLAUDE.md §7).

### 6. Outputs we produce

**A1 deliverables (per case):**
- **Rejection analysis card** — category, confidence, quoted evidence from the letter, reversal probability with a confidence band, insurer-pattern context ("This insurer rejects 40% of waiting-period-adjacent claims; of those we've analysed, 68% were reversed at grievance stage")
- **Grievance letter** — English PDF with full IRDAI citations + addressee block pre-filled + editable in-browser before download; plain-language summary in user's locale below each paragraph so they understand what they're signing
- **Document checklist** — what to attach when filing, in order
- **Self-filing guide** — step-by-step: find your insurer's grievance cell address (we pre-fill), submission method (email/portal/registered post), what happens in 14 days, what happens after
- **Bima Bharosa + Ombudsman templates** — prepared for the user but not pre-filed; they use our drafts when the time comes
- **Follow-up survey links** at +14d/+30d/+60d/+120d via WhatsApp + email

**B deliverables (ongoing):**
- **Claim Readiness Score** per policy (0–100) + per family + overall
- **Gap alerts** with specific actions ("Your floater has a ₹5L limit but your family's out-of-pocket healthcare costs averaged ₹2.1L last year; consider top-up")
- **Waiting-period timeline** — visualised per condition per family member
- **Annual or quarterly re-score** triggered automatically

**Outputs we DO NOT produce in Phase 1:**
- Actual filings with the insurer (that's A2 — deferred)
- Actual Ombudsman submissions
- Anything that carries SurakshaSaathi's name as the user's representative in a regulatory proceeding
- Recommendations to buy specific policies (advisory-only posture — we explain the gap, user decides)

### 7. Agents + tools

**Decided 2026-04-18.** Uses most of the seeded agent roster. DeadlineWatcher is dormant in Phase 1 (no active cases); it wakes for A2.

| Agent | Model | Role in MVP | Human review? |
|---|---|---|---|
| **IntakeAgent** | Haiku | Classifies request type, checks for off-scope (non-health, old, life, motor). Routes accordingly. | No |
| **DocumentAgent** | Sonnet | OCR + structured extraction from rejection letter + policy + hospital bill | No |
| **RejectionClassifier** | Opus | Categorises rejection, computes reversal probability, produces insurer-pattern context from DB | **Yes** (content_editor) |
| **EscalationDrafter** | Sonnet | Drafts the grievance letter in English with IRDAI citations + plain-language locale summary | **Yes** (content_editor) |
| **ReviewAgent** | Opus | Pre-reviews the draft for citation errors, tone, factual-support, flags issues to the human reviewer | No (itself an automated reviewer) |
| **PolicyHealthScorer** (SKU B) | Sonnet | 5-dimension score on a policy + family | No |
| **GapFinder** (SKU B) | Sonnet | Turns score into actions | No |
| **TranslationAgent** | Sonnet | Translates the plain-language explanations using the insurance glossary | No |

**Tools (registered via `@suraksha/agent-sdk`):**
- `extract_policy_fields(document_id)` — Sonnet-tool for DocumentAgent
- `extract_rejection_fields(document_id)` — Sonnet-tool for DocumentAgent
- `lookup_rejection_patterns(insurer, category)` — Opus/Sonnet-tool querying the pattern DB
- `lookup_irdai_circular(topic)` — returns the relevant IRDAI regulation citation for drafter
- `lookup_policy_terms(policy_id)` — returns extracted fields from user's policy
- `list_insurer_grievance_contacts(insurer)` — returns grievance cell email/address for pre-fill
- `list_ombudsman_jurisdiction(state)` — returns the right Ombudsman office for user's state

**Review gate policy (non-negotiable):**
- Every drafted grievance letter AND every Bima Bharosa / Ombudsman template goes through:
  1. ReviewAgent scan (automated)
  2. content_editor approval in admin portal (human)
- User never sees an auto-generated letter without these two gates. Phase 1 volume expected low enough (30 cases/month Month 1, scaling up) that this is staffable.

**Review gate is NOT required for:**
- IntakeAgent routing decisions
- DocumentAgent extractions (shown to user but not to a regulator)
- PolicyHealthScorer outputs (score is advisory, not actionable against an insurer)
- GapFinder alerts

### 8. Integration points

**Decided 2026-04-18.** Minimal external surface in Phase 1.

| Integration | Purpose | Phase |
|---|---|---|
| **Razorpay Orders + Subscriptions** | One-time ₹999 (A1) + annual ₹499/₹999 (B) + webhook reconciliation | MVP |
| **WATI** | WhatsApp intake + case-ready notifications + follow-up surveys | MVP |
| **MSG91 / Supabase SMS** | Phone-OTP delivery + email fallback | MVP |
| **Supabase Storage (India)** | Document storage with RLS | MVP |
| **Anthropic API** | Agent runtime (Opus/Sonnet/Haiku) with prompt caching | MVP |
| **Tesseract / Vision API** | OCR for uploaded PDFs + photos | MVP (vendor TBD) |
| **Sentry + Vercel Analytics** | Error + usage telemetry | MVP |
| Insurer grievance-cell directory | Curated DB of addresses + emails; updated manually via admin portal | MVP |
| Insurance Ombudsman office directory | 17 zonal offices, curated in DB, updated via admin portal | MVP |
| NHA / Bima Bharosa portal | Not integrated (user self-files); we deep-link to the portal + pre-populate the complaint text via clipboard | Phase 2 candidate |
| Insurer direct APIs | Not integrated; would require per-insurer partnerships | Phase 3+ (A2 territory) |
| ABDM / ABHA | Not used | Phase 2+ |

### 9. Monetization

Constraints already fixed (CLAUDE.md, ADR-0002):
- Advisory-only posture — no IRDAI broker license, no direct placement
- Revenue: subscription + success fees + affiliate referrals
- No hidden fees, server-side enforcement, Razorpay for money

Strategy-doc model for this vertical:
- Post-rejection success fee: 12–15% of recovered amount
- Case registration fee (upfront, reduces CAC): ₹499 non-refundable
- Expedited paid track: ₹1,999
- Pre-claim subscription: ₹499–999/year per family
- B2B corporate: ₹50–150/employee/year

**Decided 2026-04-18.**

Phase 1 MVP price-book (guidance-only scope):

| SKU | Price | Notes |
|---|---|---|
| **A1 Letter-only** | **₹999 flat upfront** | Razorpay Order; captured before any agent work runs. Refund policy: if we fail to deliver the analysis + letter within 24h of payment, full refund (self-serve in account page). No refund after delivery. |
| **B Silver** | **₹499/yr** | Razorpay Subscription. Annual Claim Readiness audit + gap alerts. Renews annually. Cancel anytime — no pro-rata refund. |
| **B Gold** | **₹999/yr** | Razorpay Subscription. Quarterly re-audits + family coverage map + priority email support. Cancel anytime. |
| Cross-sell discount | 50% off A1 for active B subscribers | When an active subscriber files a new rejection, A1 costs ₹499 instead of ₹999. Drives retention on B. |
| Re-analysis on loss | Free | If a user files and insurer rejects the grievance too, we re-analyse (new letter for Bima Bharosa + Ombudsman template) at no additional cost. |

**Deferred to Phase 2:**
- A2 Full-case pricing (₹499 upfront + 12% of recovery, escrow flow)
- Expedited track (₹1,999)
- B2B SaaS tiers

**Collection + escrow:**
- All payments via Razorpay (per CLAUDE.md §5).
- No card/bank details stored — tokens only.
- Success-fee escrow deferred with A2.
- Every payment event writes an `audit_log` row (per CLAUDE.md §5).

### 10. MVP cut vs. fast-follow — consolidated

**In MVP (ships Day 1):**
- A1 Letter-only SKU end-to-end (intake → agents → human review → delivery → self-filing guide)
- B Silver + Gold pre-claim subscriptions with PolicyHealthScorer + GapFinder
- Web intake (responsive, EN/HI/KN)
- WhatsApp intake via WATI
- Phone-OTP auth, Razorpay payments
- DocumentAgent OCR pipeline for PDFs + phone photos
- Rejection pattern DB (write path + admin viewer)
- Admin case queue for content_editor review of drafted letters
- Follow-up survey cadence (+14d, +30d, +60d, +120d)
- Curated insurer grievance-cell directory + Ombudsman zonal-office directory (admin-editable)
- Razorpay webhook reconciliation + refund self-serve page

**Fast-follow (Phase 2, after proof):**
- A2 Full-case "we fight" SKU — filing on user's behalf, SLA tracking, Ombudsman filing automation, success-fee escrow
- Life + motor + travel + cyber rejection support
- Claims > ₹5L (still health)
- Claims > 6 months old (careful review — adverse selection)
- Insurer portal pre-population (paste-ready complaint text for each insurer)
- Voice-note intake on WhatsApp (Sarvam AI)
- Pattern-DB public dashboard (aggregate, no PII)
- Expedited ₹1,999 track

**Phase 3+:**
- B2B API — HR/broker/hospital-TPA white-label
- Insurer direct-file APIs
- Consumer-court filing support
- Multilingual letter PDFs (beyond English + locale summary)

### 11. Success metrics

Strategy-doc North Star: **₹ recovered per ₹ invested in the platform.**

Baseline targets from strategy doc:
- Month 1: 30 manually resolved cases, ₹0 revenue, max learning
- Month 3: ₹5.5L MRR (50 cases/month)
- Month 6: ₹24L MRR (300 cases + 2,000 subscriptions)
- Month 12: ₹45L MRR (1,000 cases + 15,000 subscriptions + B2B pilots)
- Win rate target Month 6: 70%+ (build rejection pattern DB fast)

**Decided 2026-04-18.**

**North Star (retained from strategy doc):** ₹ recovered per ₹ invested in the platform. Requires the follow-up survey signal — that's why the 14/30/60/120-day survey cadence is in MVP.

**Leading indicators (instrumented Day 1):**
- A1 paid intakes per week (target Month 1: 10/week; Month 3: 50/week; Month 12: 250/week)
- A1 median time from payment → delivered (target < 24h, stretch < 8h)
- % of drafted letters that pass human review unchanged (higher = agent quality rising; target 70%+ by Month 3)
- Pattern-DB density — cases per (insurer × rejection category × ICD) cell (moat proxy)
- B subscribers (target Month 3: 200 Silver, 50 Gold; Month 12: 2,000 Silver + 500 Gold)
- A1 → B conversion rate on delivered cases (target 5% — "loved the letter, want to avoid this again")
- Follow-up survey response rate at +30d (signal for North-Star, target > 40%)
- User-reported reversal rate conditional on filing (target > 55% at +120d — below Ombudsman's 70% because we include weak-evidence cases; we iterate classifier prompts to improve)
- WhatsApp share rate of the "analysed rejection" page (virality)
- Complaint: user-reported letter errors per 100 delivered (quality gate — target < 2)

**Lagging (monthly):**
- Gross recovery reported via surveys (₹)
- Refund rate (target < 5%)
- Active B subscribers + churn
- Agent cost per case (should fall with caching + scale)
- Staleness of pattern-DB (insurer practices change; recent-case coverage matters)

### 12. Risks & edge cases

Starter set from strategy doc + engineering instructions:
- **Working capital lock** — Ombudsman cases take 3–4 months; ₹499 upfront + paid expedited partially bridges. Tracks to user's cashflow not just ours — recovered amount only hits user's account at end.
- **Adverse selection** — complex old cases and very high-value cases have lower win rates; strategy doc mitigates by restricting launch to claims <6 months old, amounts <₹5 lakh, health insurance only
- **Insurance Samadhan copies product** — technical weakness is their answer; build the pattern DB they don't have
- **Regulatory gray zone** — "information and drafting service" not legal representation; Insurance Samadhan 7-year precedent, but watch IRDAI posture closely
- **Document authenticity** — users can forge policy/rejection docs; need fraud checks
- **Insurer retaliation** — when we systematically win, insurers may: push back in court, try to delist our customers, raise premiums. Mitigations: legal counsel retained, never take an insurer to court ourselves (always escalate through regulatory channels)
- **LLM hallucination on regulated text** — letters to IRDAI / Ombudsman with wrong citations are harmful; ReviewAgent + human review gates all outbound regulated filings
- **Deadline miss** — missing an IRDAI 14-day response or Ombudsman filing window is case-killing; DeadlineWatcher + automatic escalation + human fallback

### 13. Open questions

_Flushed at PRD close 2026-04-18. Each becomes an issue when we start building._

- **OCR vendor.** Tesseract (self-hosted, free, lower accuracy on Devanagari/Kannada and phone photos) vs cloud Vision API (Google/AWS; higher accuracy + cost; DPDP implications). Decide at build time based on early A1 image-quality observations.
- **Insurer grievance-cell directory source.** Manual curation in admin portal at MVP (estimated ~2 hours per insurer × 30 = one-time 60-hour content task). Worth attempting a partnership / public dataset later.
- **Pattern DB public dashboard.** When, if ever, do we publish aggregate stats? Great for brand + SEO + regulator relations; risk of insurer blowback. Phase 2 decision.
- **Refund window operations.** 24-hour delivery SLA + self-serve refund page means we need on-call content_editor coverage. Staffing model to decide with content team.
- **Re-analysis-on-loss policy edges.** Do we re-analyse for free forever, or once? Probably once, with a discounted ₹299 re-analysis after that — document in pricing FAQ at launch.
- **Follow-up survey fatigue.** 4 WhatsApp pings may feel spammy. Consider compressing to 30d + 120d after Month 3 data.
- **"Letter in Hindi/Kannada" requests.** Some users will want the full letter in their language, not English-with-locale-summary. Some insurers accept regional-language complaints, some don't. Policy decision pending IRDAI/insurer research.
- **Content editor hiring.** Need 1–2 editors with insurance-claims domain knowledge before Day 1 launch. Critical path.

---

## Sign-off

**PRD status:** Draft complete 2026-04-18. Pivoted 2026-04-18 afternoon.

---

## 2026-04-18 Pivot — Free two-feature MVP

The user re-scoped Phase 1 of Claims Advocacy away from the paid-letter ladder to a **free, anonymous AI-analysis tool** with two features. The full-case / letter-drafting model is deferred to a later phase.

**New Phase 1 features:**

1. **Analyse your policy deeply** — upload a policy PDF or photo, get a plain-language deep-dive in the user's locale:
   - Coverage summary (what's actually covered)
   - Waiting periods per condition
   - Exclusions, highlighted with plain-language explanation
   - Red flags / fine-print surprises
   - Premium and renewal terms
   - Nominee status (if visible)
   - Claim-readiness score (0–100) with specific improvement actions

2. **Check if your claim will be covered** — describe a scenario (condition / hospital / amount / date-of-event), AI predicts coverage with reasoning:
   - Green / Amber / Red prediction with confidence
   - Which policy clauses apply and why
   - What could go wrong (waiting-period miss, exclusion hit, pre-auth required, documentation gap)
   - What to do NOW to improve odds (pre-authorise, gather docs, wait N months)
   - Document checklist for the actual claim

**Scope revisions:**

- ~~A1 Letter-only ₹999 SKU~~ — deferred to a later phase
- ~~A2 Full-case SKU~~ — deferred
- ~~B Pre-claim subscription~~ — folded into feature 1 (the Claim Readiness score is now free + in-session; no subscription)
- ~~Razorpay integration for Claims module~~ — not needed in this phase
- ~~Human content-editor review queue for drafted letters~~ — not needed (no outbound letters)
- ~~Follow-up survey cadence (+14d/+30d/+60d/+120d)~~ — not needed (no cases)
- ~~Case entity + case_event + case_status lifecycle for Claims~~ — not needed
- ~~Rejection pattern DB~~ — deferred (no rejections analysed in this version)
- ~~Insurer grievance-cell directory~~ — deferred
- ~~Ombudsman office directory~~ — deferred

**Kept (and now simpler):**

- Document upload + OCR + DocumentAgent extraction
- Anonymous users — no signup, no payment
- 3 launch locales (EN / HI / KN)
- Share-via-URL for analysis results (opaque ID, 7-day expiry)

**New agent roster for Phase 1:**

| Agent | Model | Role |
|---|---|---|
| DocumentAgent | Sonnet | OCR + structured extraction from policy |
| **PolicyAnalyzer** (new) | Opus | Deep analysis of the extracted policy → report JSON |
| **CoveragePredictor** (new) | Opus | Scenario + policy → Green/Amber/Red prediction with reasoning |
| TranslationAgent | Sonnet | Localise the plain-language explanation sections |

Review-required flag is **false** for all four — outputs go to the user directly, never to a regulator. "AI assistant — verify important details with your insurer" disclaimer on every report.

**Data model:**

Two new tables for anonymous analyses:

- `policy_analysis` — opaque id, document_id, locale, report_json, created_at, expires_at (now + 7 days)
- `coverage_check` — opaque id, analysis_id (nullable), scenario_json, result_json, created_at, expires_at

No `user_id`, no `tenant_id` at row level (well, `tenant_id` remains for multi-tenant but stays `surakshasaathi` for the public B2C tenant). Expired rows auto-deleted via a daily cron.

**Auth decision:** Anonymous — no signup. An opaque share URL (`/policy-health-score/analysis/<id>`) gives return access. "Save to account" CTA at the bottom of each report is deferred to a later phase.

**Dev-stub mode:** Because the user is still setting up Supabase / Anthropic / Razorpay, all agent calls have a stub fallback: when `DEV_STUBS=true` (or `ANTHROPIC_API_KEY` is missing), return canned analysis JSON for a known demo policy. Real credentials flip to real agents via env variable change, zero code change.

**Revised success metrics:**

North Star: **% of analysed policies where the user takes a coverage-prediction action within 24h.** Proxies for "this tool was useful."

Leading indicators:
- Policies analysed per week
- % of analyses that lead to a coverage-check
- Share rate (analysis URLs shared)
- Return-visit rate within 7-day expiry window
- Ratio of green / amber / red predictions (product-health metric)

**This PRD supersedes the earlier paid-ladder version** for all Phase 1 build work.

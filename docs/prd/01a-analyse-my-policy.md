# Feature Spec — Analyse My Policy

> Detailed design for the Before-chapter flagship moment on the SurakshaSaathi platform. Reviewable artifact — no code until sign-off.
> Parent context: `feedback_platform_positioning.md` (platform identity). The Analyse-My-Policy moment lives under the **Policy Health Score** module (Before chapter); Claims Advocacy is the separate After-chapter rejection-letter flow.
> Adjacent moments: Check-if-claim-will-be-covered (Before, same module); Fight-rejected-claim (After); Scan-parents-policies (Before, Senior Portal).

- **Status:** Draft 2026-04-18 · Reframed 2026-04-18 as a platform moment (not a feature)
- **Chapter:** **Before** — prepare, understand, prevent
- **Moment in the user's life:** "I bought a policy; I want to know what I actually signed up for, before anything goes wrong."
- **Module (internal grouping):** `policy-health-score`
- **Route:** `/[locale]/policy-health-score/analyse` (upload) → `/[locale]/policy-health-score/analysis/[id]` (report)
- **Auth:** Anonymous — no signup required
- **Pricing:** Free, forever (core platform principle — the Before chapter is always free)
- **Data residency:** Supabase India (AWS Mumbai); uploads auto-deleted after 7 days

---

## 1. Summary

SurakshaSaathi is a platform for winning every protection claim — before, during, and after. The **Before chapter's promise** is: *"Know what you have. Fix the gaps."* Analysing a policy deeply is the chapter's flagship moment.

A user uploads a health-insurance policy (PDF or phone photo). In ~60–120 seconds the platform returns a plain-language deep-dive — every exclusion, every waiting period, every sub-limit, every surprise hidden in the fine print — in English, Hindi, or Kannada. The report is shareable via an opaque URL with a 7-day expiry.

The feature is free forever and stands alone as useful. But its deeper role in the platform is to be the **on-ramp into the relationship** — the moment where the user first experiences our independence + expertise, and the moment that begins the longitudinal protection record we build for their family over the next ten years. When something eventually does go wrong (rejection, scheme refusal, mis-selling discovery), they come back — because we were already there.

**Success here is measured by how many users share it in WhatsApp family groups.** If it's not good enough to share, it's not the platform's on-ramp; we lose the compound.

---

## 2. Scope

### In scope (MVP)

- Health-insurance policy PDFs + phone-photo uploads (max 20 MB, up to 100 pages)
- One policy per analysis (multi-policy stacking is fast-follow)
- Three launch locales: English, Hindi, Kannada
- Anonymous access; opaque share link; 7-day TTL
- Standard 10-section deep-dive report (see §5)
- Claim Readiness Score (0–100)
- Red-flag detection (clauses the user probably missed)
- Per-section confidence + "verify with insurer" disclaimers
- Downloadable report PDF
- Share-on-WhatsApp with link preview

### Out of scope (defer)

- Life-insurance / motor / travel / cyber policies — fast-follow
- Corporate group-policy-document format — fast-follow (different layout + cert-of-insurance references)
- Multi-policy family dashboard — that's Family Insurance OS (Idea 4)
- Policy-to-policy comparison — that's Policy Health Score (Idea 2)
- Claim filing assistance — that's the paid Letter SKU (deferred, Phase 2 of Claims Advocacy)
- Coverage prediction for a specific scenario — that's Tool #2 (separate spec)
- Saved "my policies" library — requires accounts (deferred to post-MVP auth)
- Policy in non-launch locales (Tamil/Telugu/Bengali UI + output) — Phase 1.5

---

## 3. User Experience Flow

### 3.0 Entry points — how the user arrives

The user lands here from multiple origins — every origin must feel consistent with the platform promise:

- **From the landing page Before chapter** — moment card *"Analyse my policy deeply"* deep-links directly to the upload screen with the locale preserved.
- **From organic search** — Google results for *"health insurance policy analysis"*, *"what is my policy waiting period"*, etc. SEO-optimised upload page with benefit-forward H1.
- **From a WhatsApp share** — a previous user shares their report URL to a family group; the recipient opens the read-only report, and the platform offers *"Analyse your own policy"* as a sticky CTA.
- **From another moment on the platform** — e.g. a Scheme-Navigator result saying *"You qualify for PM-JAY — but the policy you already have may overlap; analyse it here to see."*
- **From the closing CTA of the landing page** or the post-completion CTA of a different moment (e.g. after coverage-check).

Every entry point carries the same anonymous session token so the analysis links into the user's lifetime record if/when they later sign up.

### 3.1 Upload screen — `/[locale]/policy-health-score/analyse`

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                          Before · Moment 1  │
│                                                                     │
│  Know what you have.                                                │
│  Upload your policy. We'll read every page, every clause, every     │
│  footnote, and hand you back a plain-language map of what's         │
│  covered, what isn't, and the surprises nobody told you about.      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │    📄 Drop your policy PDF here                             │   │
│  │       or tap to take a photo                                │   │
│  │                                                             │   │
│  │    PDF · JPG · PNG · HEIC        Max 20 MB · 100 pages     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  On your side only:                                                 │
│  ✓ Free. No account. We never ask for Aadhaar.                     │
│  ✓ Indian servers. Auto-deleted in 7 days. Delete now if you want. │
│  ✓ We don't share your document with insurers — ever.              │
│                                                                     │
│  Language: [English ▾]                                              │
│                                                                     │
│  — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —     │
│  After this moment, you'll likely want:                             │
│    → Check if my next claim will be covered (2 min more)            │
│    → See schemes my family qualifies for                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Copy principles (platform voice):**
- Lead with the chapter promise (*"Know what you have."*) — not the feature name.
- *"On your side only"* for the privacy block — signals the independence/trust pillar of the platform.
- Adjacent moment CTAs always visible — the user sees platform breadth before completing even this moment.

**Behavior:**
- File selected → client-side validation (size, mime, page count) → upload starts
- Upload progress bar
- On upload success → redirect to `/analysis/[id]` with analysis in `queued` state
- On validation failure → inline error with a link to *"How do I export my policy as a PDF?"* helper
- Off-scope document detection (life / motor / non-policy) → user sees *"Your document looks like X. We'll support that soon — join the waitlist for the {X} moment."* — cross-sells platform breadth instead of dead-ending.

### Analysis in progress — `/[locale]/policy-health-score/analysis/[id]` while `status in (queued | ocr_running | analysing)`

```
┌─────────────────────────────────────────────────────────────────────┐
│  ● Reading your policy…                                  est. 90s  │
│                                                                     │
│  ● Extracting the details from page 1 of 34                        │
│  ○ Identifying what's covered                                      │
│  ○ Finding exclusions and waiting periods                          │
│  ○ Generating your report in English                               │
│                                                                     │
│  [ Share this page later ] — keep the URL; it works for 7 days.    │
└─────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Page polls a server action every 3s for status
- Steps light up as they complete
- If an error occurs: "Something went wrong — try again" + re-upload CTA; analysis row marked `failed`, cause logged server-side
- If user closes the tab, the analysis continues; they can return via the URL

### Report page — `/[locale]/policy-health-score/analysis/[id]` when `status = ready`

Full 10-section report (see §5). Layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header                                                             │
│    Insurer logo · Plan name · Policy number · Language toggle      │
│    [ Download as PDF ]  [ Share on WhatsApp ]  [ Delete now ]      │
│  ────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Claim Readiness Score: 72/100  [●●●●●●●○○○]                       │
│  What this means + top 3 actions                                   │
│                                                                     │
│  ┌─ Section navigation (sticky) ────────────────────────────────┐  │
│  │  1. Quick summary                                            │  │
│  │  2. Basic facts                                              │  │
│  │  3. What's covered                                           │  │
│  │  4. What's NOT covered                                       │  │
│  │  5. Waiting periods                                          │  │
│  │  6. Sub-limits & caps                                        │  │
│  │  7. Co-pay & deductibles                                     │  │
│  │  8. Red flags                                                │  │
│  │  9. Claim readiness                                          │  │
│  │  10. What to do now                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ──────────────────────── Report sections ─────────────────────── │
│                                                                     │
│  AI Assistant disclaimer — "Verify important details with your    │
│  insurer before making decisions."                                 │
│  ────────────────────────────────────────────────────────────────  │
│  What next?                                                         │
│    [ Try Check if my claim will be covered ]  → Tool #2            │
│    [ Join the waitlist ]  → other 6 modules                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Error screen — `status = failed`

- Clear non-technical message
- Re-upload CTA
- "Message us" mailto fallback for persistent failures

---

## 4. Feature List (comprehensive)

### Core (MVP)

| ID | Feature | Description |
|---|---|---|
| F-101 | PDF upload | Drag-drop + click-to-upload PDF, max 20 MB, max 100 pages |
| F-102 | Photo upload | Phone camera capture or library, auto-rotates + stitches multiple pages |
| F-103 | File validation | Client: mime, size, page count. Server: re-validate, reject on malware sig |
| F-104 | Locale selection | English / Hindi / Kannada; persists to session |
| F-105 | Anonymous session token | Signed cookie; analysis row linked to session but no PII |
| F-106 | Progress page | Polls status, shows 4 stage lights, graceful failures |
| F-107 | OCR pipeline | Extract full text + per-page positional tokens |
| F-108 | Document-kind detection | Agent checks it's actually a health-insurance policy — not a random PDF |
| F-109 | Field extraction | Structured extraction of 25+ standard fields |
| F-110 | Deep analysis | PolicyAnalyzer agent produces the 10-section report JSON |
| F-111 | Localization | TranslationAgent produces Hindi + Kannada versions of the plain-language sections |
| F-112 | Report page | Render the JSON as the structured report in §5 |
| F-113 | Claim Readiness Score | 0–100 score + sub-scores per dimension |
| F-114 | Red-flag detection | List of clauses the user probably missed, with reasoning |
| F-115 | Confidence indicators | Per-section confidence + "verify with insurer" disclaimer |
| F-116 | Citations to clause | Each extracted fact cites a clause reference (page + section label) |
| F-117 | PDF download | Server-generated PDF of the full report |
| F-118 | WhatsApp share | Pre-composed, locale-appropriate message + link |
| F-119 | Delete-now button | User can delete the analysis immediately (not wait for 7-day TTL) |
| F-120 | 7-day auto-expiry | Daily Trigger.dev cron deletes expired rows + storage blobs |
| F-121 | Error handling | Clear messages for file-too-big, wrong-format, OCR-failed, analysis-failed |
| F-122 | Feature flag gate | `module.policy-health-score.analyse_open` flag kill-switch |
| F-123 | Rate limiting | 5 analyses / hour per IP (abuse control) |
| F-124 | Analytics events | Anonymised funnel tracking (upload-start, upload-success, ocr-done, analysis-done, share, download) |
| F-125 | Admin review queue | Content editor can flag an analysis as "quality concern" → retrains prompts |

### Fast-follow (post-MVP)

| ID | Feature | Description |
|---|---|---|
| F-201 | Multi-policy stacking | "Add another policy" builds a comparison — bridges to Policy Health Score |
| F-202 | "Save to account" | Post-MVP phone-OTP signup persists the analysis permanently |
| F-203 | Share to a family member | WhatsApp flow that invites a second user to see the same report |
| F-204 | Regional-script policy input | OCR + extraction for policies issued in Hindi / Kannada / Tamil |
| F-205 | Life-insurance extension | Same pipeline, different extractor + analyser tuned for life + ULIP |
| F-206 | Voice summary (Sarvam) | Audio version of the summary for low-literacy users |
| F-207 | Claim-event readiness drill | Simulate "hospitalised tomorrow" → what would actually happen |
| F-208 | Printable checklist | One-page take-to-hospital handout |
| F-209 | Personalised renewal alert | 60/30/7-day renewal ping — requires account |
| F-210 | Group policy support | Corporate / employer policy parsing (different structure) |
| F-211 | AI Q&A on the report | Chat widget to ask ad-hoc questions about the policy |
| F-212 | Deep-link to Tool #2 | "Will X be covered?" → pre-fills coverage check with this analysis |

---

## 5. Report Structure (what the user actually sees)

Ten sections, every section always rendered (with "not found in your policy" fallback where applicable). All sections carry a `confidence` 0–1 and a `citations[]` list.

### Section 1 — Quick summary

Executive paragraph, 3–5 sentences. "This is a ₹5 lakh family floater from Star Health. It covers hospitalisation for all standard procedures. The three most important things to know: (a) there's a 3-year wait for diabetes-related claims, (b) a 1% room-rent sub-limit, (c) day-care procedures are capped at ₹50,000."

### Section 2 — Basic facts

Structured table:

| Field | Value | Citation |
|---|---|---|
| Insurer | Star Health & Allied Insurance | Page 1, header |
| Plan name | Family Health Optima | Page 1, header |
| Plan type | Family floater | Page 2, § 1.2 |
| Sum assured | ₹5,00,000 | Page 1, schedule |
| Members covered | Self, spouse, 2 children (<25y) | Page 3, § 3.1 |
| Policy period | 01-Apr-2025 to 31-Mar-2026 | Page 1, schedule |
| Premium | ₹22,450/yr | Page 1, schedule |
| Nominee | M. Kumar (spouse) | Page 4, § 4 |
| Pre-existing declared | Hypertension (self) | Page 5, § 5.2 |
| Network hospitals | 14,030 cashless | Brochure reference |

### Section 3 — What's covered

Categorised list with plain-language descriptions. Categories: inpatient, day-care, pre-hospitalisation, post-hospitalisation, ambulance, AYUSH, maternity, organ donor, domiciliary hospitalisation, restoration of sum insured, health check-up, etc. Each shows:
- Coverage status (✓ / ✓ with conditions / ✗)
- Plain-language note
- Clause citation

### Section 4 — What's NOT covered (exclusions)

Permanent + temporary exclusions as two sub-lists. Plain-language explanation per exclusion — not just the legalese. Highlight exclusions the user is likely to be surprised by (e.g. "cosmetic surgery" — obvious; "consumables like gloves and syringes during admission" — usually surprises).

### Section 5 — Waiting periods

Visual timeline:

```
Day 0 ────── Day 30 ────── Year 1 ────── Year 2 ────── Year 3 ────── Year 4
  │              │             │             │             │             │
  ├── Accident coverage active from Day 0                                 │
  │              ├── All standard illnesses covered after 30 days         │
  │              │             ├── ENT + joint replacement after 1 yr     │
  │              │             │             ├── Cataract after 2 yrs    │
  │              │             │             │             ├── PED (if   │
  │              │             │             │             │    declared)│
  │              │             │             │             │    after 3y │
```

Per-condition table with exact waiting period. Flagged items if the user already has a declared condition pending wait-period end.

### Section 6 — Sub-limits & caps

Per-service caps on payouts. Common ones: room rent (% of sum assured or ₹ cap), ICU, cataract, maternity, ambulance, dental, mental-health, modern-treatment proportional cap. Each row shows:
- The cap amount/percentage
- What happens if the bill exceeds it (proportionate deduction is the usual gotcha)
- Plain-language note

### Section 7 — Co-pay & deductibles

Is there a co-pay? Voluntary or mandatory? Age-based co-pay? Deductible amount? Per-claim or per-year?

### Section 8 — Red flags

AI-generated list of items the user probably didn't realize. Each red flag has:
- **The flag** — one sentence
- **Why it matters** — consequence in a real claim
- **The evidence** — quoted clause verbatim
- **Severity** — high / medium / low
- **What to do** — specific action (if any)

Examples:
- "Your policy deducts 10% of any claim amount if you're over 60. If you're 63 now, every ₹1 lakh claim pays out ₹90k."
- "Room rent is capped at 1% of sum assured = ₹5,000/day. Most Bengaluru hospitals charge ₹8,000+ for a single private room. Any excess room cost triggers proportionate deduction across the entire bill — not just the room bill."

### Section 9 — Claim Readiness Score

0–100 composite across 5 dimensions (weighted):

| Dimension | Weight | What it measures |
|---|---|---|
| Coverage adequacy | 35% | Sum assured vs avg urban household claim |
| Exclusions & gaps | 25% | Count and severity of gotchas |
| Waiting-period clearance | 15% | How much of the 1-to-4y waits has already been served |
| Nominee accuracy | 10% | Is a nominee declared + is it reasonable |
| Documentation completeness | 15% | Were the pre-existing declarations thorough |

Plus a short narrative: "Your 72 score is average for Indian family floaters. The biggest hits are a low 1% room-rent sub-limit and an incomplete list of declared conditions."

### Section 10 — What to do now

3–5 concrete actions, ranked by impact. Each is a single card with:
- Action title ("Add 'diabetes' to your declared pre-existing conditions")
- Why ("Avoids a non-disclosure repudiation if you claim later for diabetes-adjacent treatment")
- How (specific — call insurer's portfolio-change line; typical SLA 15 days)
- Urgency badge (do-today / do-this-month / optional)

---

## 6. Backend Architecture

### Stack

Inherits from `CLAUDE.md` §3. Specifically for this feature:

| Layer | Tech |
|---|---|
| Hosting (web) | Vercel (Next.js 15 App Router) |
| Intake API | Next.js Server Actions + a signed-URL upload to Supabase Storage |
| Storage | Supabase Storage (India region) bucket `policy-docs`, RLS: writes allowed for anon; reads require session-token match |
| Database | Supabase Postgres (India region) |
| Background jobs | Trigger.dev (durable workflow, retries, scheduled cleanup) |
| OCR | Google Vision API (cloud) — chosen over Tesseract for accuracy on phone photos. Vendor locked after a 10-sample benchmark in Phase 1 Week 1 |
| Agent runtime | `@suraksha/agent-sdk` → Anthropic API. Prompt caching enabled for system prompts |
| PDF export | `@react-pdf/renderer` server-side from the report JSON |

### High-level flow

```
  ┌───────────────┐
  │   Browser     │  [user uploads PDF / photo]
  └──────┬────────┘
         │ 1. POST /api/analyse/create → returns { analysisId, uploadUrl }
         │ 2. PUT uploadUrl (signed) → Supabase Storage
         │ 3. POST /api/analyse/{id}/start → enqueues Trigger.dev job
         │
         ▼
  ┌────────────────────────────────────────────────────────┐
  │       Next.js Server Action layer                      │
  │  Validates · rate-limits · writes initial DB row       │
  └──────┬─────────────────────────────────────────────────┘
         │ enqueue
         ▼
  ┌────────────────────────────────────────────────────────┐
  │       Trigger.dev — analyse-policy workflow            │
  │                                                        │
  │   step 1: OCR via Google Vision  (30–60s)              │
  │           → writes policy_document.ocr_text            │
  │                                                        │
  │   step 2: IntakeAgent (Haiku)                          │
  │           → confirms it's a health policy              │
  │           → guards against off-scope uploads           │
  │                                                        │
  │   step 3: DocumentAgent (Sonnet)                       │
  │           → structured field extraction, 25+ fields    │
  │                                                        │
  │   step 4: PolicyAnalyzer (Opus, review-optional)       │
  │           → generates 10-section report JSON           │
  │           → with citations + confidence per section    │
  │                                                        │
  │   step 5: TranslationAgent (Sonnet) x2                 │
  │           → produces Hindi + Kannada variants of       │
  │             the plain-language fields                  │
  │                                                        │
  │   step 6: ReviewAgent (Opus)                           │
  │           → scans for hallucination / over-confidence  │
  │           → suppresses any claim below threshold       │
  │                                                        │
  │   step 7: Persist                                      │
  │           → writes policy_analysis.report_json         │
  │           → status = ready                             │
  │                                                        │
  │   (concurrency: 10 jobs; retry 3x on transient fail)   │
  └────────────────────────────────────────────────────────┘
         │
         ▼
  ┌────────────────────────────────────────────────────────┐
  │       Browser polls /api/analyse/{id}/status           │
  │       Renders report when status = ready               │
  └────────────────────────────────────────────────────────┘
```

### Scheduled jobs

- **`analysis-expiry-sweep`** — daily at 02:00 IST. Deletes `policy_analysis` + `policy_document` rows past `expires_at`. Deletes corresponding Supabase Storage blobs.
- **`analysis-metrics-rollup`** — hourly. Anonymised aggregate counts for the admin overview page.

---

## 7. Data Model

Two new tables; both keyed by opaque UUIDs. No PII. Existing `document` / `case` tables are NOT used — this feature deliberately sidesteps the case-management domain.

```sql
-- Policy document: the uploaded file + OCR output.
create table policy_document (
  id                uuid primary key default gen_random_uuid(),
  storage_path      text not null,              -- supabase-storage key
  content_sha256    text not null,              -- dedup key
  mime              text not null,
  size_bytes        int  not null,
  page_count        int,
  ocr_status        ocr_status not null default 'pending',
  ocr_text          text,                        -- full text, for agents
  ocr_pages         jsonb,                       -- array of { page, text, tokens[] }
  extracted         jsonb,                       -- output of DocumentAgent
  extracted_at      timestamptz,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '7 days'
);

create index policy_document_expiry_idx on policy_document(expires_at);
create index policy_document_sha_idx    on policy_document(content_sha256);

-- Analysis record: one per upload.
create table policy_analysis (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references policy_document(id) on delete cascade,
  session_token     text not null,               -- opaque; gates read access
  locale            locale not null,
  status            analysis_status not null default 'queued',
                                                 -- queued|ocr_running|analysing|ready|failed
  progress_step     text,                        -- human-visible "extracting page 3 of 34"
  report_json       jsonb,                       -- the 10-section report
  readiness_score   int,                         -- 0-100
  readiness_components jsonb,                    -- per-dimension sub-scores
  red_flags_count   int,
  confidence_overall real,
  agent_run_ids     uuid[] not null default '{}',
  cost_paise        int not null default 0,
  error_code        text,
  error_message     text,
  started_at        timestamptz,
  ready_at          timestamptz,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '7 days'
);

create index policy_analysis_status_idx   on policy_analysis(status, created_at);
create index policy_analysis_expiry_idx   on policy_analysis(expires_at);

-- New enums
create type ocr_status as enum ('pending','running','done','failed');
create type analysis_status as enum ('queued','ocr_running','analysing','ready','failed');
create type locale as enum ('en','hi','kn','ta','te','bn','mr','gu','ml','pa','or','as','ur');
```

### RLS

- `policy_document` — insert by anyone; select only by joining through `policy_analysis.session_token = request.cookies.session_token`. Write no direct reads.
- `policy_analysis` — insert by anyone; select/update requires `session_token` match on the request cookie.
- Service role (background workers) bypasses RLS for the pipeline.

### No `user_id`, no `tenant_id` on the row level. Tenant scoping is implicit (`surakshasaathi` tenant is the only public one).

---

## 8. Agent Architecture

Five agents cooperate per analysis. All are rows in the existing `agent_definition` table, versioned. New rows for this feature:

### 8.1 IntakeAgent (Haiku, no review required)

**Purpose:** Gate — confirm we're looking at a health-insurance policy.

**Input:** first ~2,000 tokens of OCR text.

**Output JSON:**
```json
{
  "is_health_insurance_policy": true,
  "confidence": 0.94,
  "detected_insurance_line": "health",
  "off_scope_reason": null,
  "detected_locale_of_policy": "en"
}
```

**Off-scope actions:**
- If life / motor / travel / group / non-Indian → `failed` with user-visible message: "This doesn't look like a health policy. We'll support life/motor/travel/group soon — join the waitlist."
- If not a policy at all (invoice, hospital bill, user's aadhaar card) → "This doesn't look like a policy. Please upload your health-insurance policy document."

### 8.2 DocumentAgent (Sonnet, no review required)

**Purpose:** Structured field extraction.

**Input:** full OCR text + page-segmented tokens.

**Tools:** `extract_policy_fields` — input schema with 25+ canonical fields; output schema enforced via JSON mode.

**Output** (abridged):
```json
{
  "insurer_name": "Star Health & Allied Insurance",
  "plan_name": "Family Health Optima",
  "policy_number": "P/12345/2025",
  "sum_assured_paise": 50000000,
  "premium_paise": 2245000,
  "plan_type": "family_floater",
  "members": [
    { "relation": "self", "name_redacted": true, "dob_year": 1978, "pre_existing": ["hypertension"] },
    ...
  ],
  "period": { "start": "2025-04-01", "end": "2026-03-31" },
  "nominee": { "name_redacted": true, "relation": "spouse" },
  "exclusions_raw": [...],
  "waiting_periods_raw": [...],
  "sub_limits_raw": [...],
  "copay": { "percentage": null, "age_triggered": { "from_age": 60, "percentage": 10 } },
  "network_hospital_count": 14030,
  "extraction_confidence": 0.88,
  "low_confidence_fields": ["period", "premium"]
}
```

### 8.3 PolicyAnalyzer (Opus, review optional in Phase 1)

**Purpose:** Generate the full 10-section report JSON.

**Input:** DocumentAgent output + full OCR text (chunked + cached via prompt caching).

**Tools:**
- `lookup_glossary(term)` — returns approved insurance-term definitions per locale
- `lookup_urban_health_cost_bench(city, condition)` — benchmark cost data for coverage-adequacy scoring (seeded data)
- `lookup_known_red_flag_patterns(insurer, plan_type)` — pattern DB of commonly-surprising clauses

**Output:** The full 10-section report JSON (see §5). Structured output with:
- Every fact carries a `clause_citation` pointing to page + quoted verbatim text
- Every plain-language statement carries a `confidence` 0–1
- `readiness_score` + per-dimension sub-scores
- `red_flags[]` with severity

**Prompt caching:** System prompt (~3,500 tokens) + tool definitions cached. User message per-analysis.

### 8.4 TranslationAgent (Sonnet, no review)

**Purpose:** Localise the plain-language English sections into Hindi + Kannada while preserving insurance terminology from the glossary.

**Input:** English report JSON, target locale.

**Tools:** `lookup_glossary(term)` — MUST use glossary translations for regulated terms; flag any term not in the glossary as `needs_glossary_review` so a content editor can add it.

**Output:** Locale-specific overlay — a JSON object keyed by section with localised strings. Numbers, dates, and citations stay untouched.

### 8.5 ReviewAgent (Opus, review_required = false — it IS the reviewer)

**Purpose:** Last automated pass before user sees the report.

**Input:** Full report JSON + original OCR text.

**Behavior:**
- Verify each cited clause actually appears in the OCR text (anti-hallucination)
- Flag sections with `confidence < 0.5` for a "verify with insurer" inline warning
- Catch tone issues (alarmist language on a low-confidence red flag)
- Catch math errors (score components summing wrong)

**Output:**
```json
{
  "issues": [
    { "severity": "warn", "section": 8, "index": 2, "reason": "clause not found in OCR text", "action": "suppress" },
    ...
  ],
  "action_summary": "1 red flag suppressed, 3 sections marked low-confidence"
}
```

Pipeline applies the `action` — suppressions drop the item from the report; low-confidence triggers inline warning badges.

---

## 9. LLM Usage Patterns

### Model selection (per agent)

| Agent | Model | Reason |
|---|---|---|
| IntakeAgent | Haiku | Cheap gate, narrow decision |
| DocumentAgent | Sonnet | Structured extraction benefits from Sonnet's balance |
| PolicyAnalyzer | **Opus** | Highest-stakes reasoning — the full report quality depends on this |
| TranslationAgent | Sonnet | Glossary-constrained translation, low risk |
| ReviewAgent | Opus | Second opinion must match PolicyAnalyzer's reasoning depth |

### Prompt caching strategy

- **System prompts**: all 5 agents mark their system prompt as `cache_control: ephemeral`. Cache hit rate ~95% after first invocation of each agent version.
- **Tool definitions**: cached alongside system prompts.
- **Glossary + known-red-flag patterns**: injected as cached context on PolicyAnalyzer + ReviewAgent.
- **User message**: per-analysis, never cached (policy text is unique).

### Structured output

- DocumentAgent uses Anthropic tool-use mode with an enforced JSON schema to guarantee parseable output.
- PolicyAnalyzer uses prompt-directed JSON output validated by a zod schema on the server; if parse fails, 1 retry, then fail with a specific error code.

### Safety + refusals

- PolicyAnalyzer is instructed: "Never invent clauses. If a fact is not explicitly in the provided OCR text, say `not_found_in_policy` with null confidence."
- ReviewAgent independently enforces this via citation verification.

### Token budgeting

Per analysis (typical 30-page policy, ~18k OCR tokens):

| Agent | Input cached | Input fresh | Output | USD est. | INR est. (@86) |
|---|---|---|---|---|---|
| IntakeAgent | 500 | 2,000 | 200 | $0.003 | ₹0.30 |
| DocumentAgent | 2,000 | 18,000 | 3,000 | $0.12 | ₹10 |
| PolicyAnalyzer | 4,000 | 20,000 | 6,000 | $0.78 | ₹67 |
| TranslationAgent x2 | 2,000 | 6,000 | 2,500 | $0.12 | ₹10 |
| ReviewAgent | 3,000 | 24,000 | 1,500 | $0.48 | ₹41 |
| **Total** | | | | ~$1.50 | **≈ ₹130** |

This is the cost ceiling. With prompt-cache hits (2nd analysis onward), ~35–40% reduction is realistic — target **₹75–85 per analysis** at steady state.

### Latency budget

- OCR (Google Vision, 30-page PDF): 40–60 s
- IntakeAgent: 3–5 s
- DocumentAgent: 8–15 s
- PolicyAnalyzer: 25–40 s
- TranslationAgent (parallel x2): 10–15 s
- ReviewAgent: 15–25 s
- Persistence: 1–2 s
- **Total**: 100–160 s — consistent with "2 minutes" user-facing promise.

Streaming the report to the user (as sections complete) is a fast-follow improvement.

---

## 10. Performance & Abuse Controls

- **Rate limit** — 5 analyses / hour / IP (Upstash Redis token bucket, or DB-backed if we skip Redis in Phase 1)
- **File size cap** — 20 MB client + server re-check
- **Page count cap** — 100 pages (PDFs only; photos are 1 page anyway)
- **Concurrency cap** — Trigger.dev concurrency 10 per worker
- **Cost ceiling per analysis** — hard budget of ₹200; agent-sdk aborts if exceeded, analysis fails with `cost_ceiling_hit`
- **Content-type validation** — binary magic-bytes check server-side, not just mime header
- **Malware scan** — Supabase Storage has basic scanning; add ClamAV if needed
- **Fraud / abuse signals** — repeated uploads of the same `content_sha256` from different IPs flagged

---

## 11. Edge Cases & Failure Modes

| Scenario | Handling |
|---|---|
| OCR returns no text | Fail with `ocr_empty` — "We couldn't read your document. Try a clearer photo or a PDF export from your insurer." |
| OCR returns very low confidence | Proceed but surface an orange "low OCR quality" banner on the report |
| Non-English policy (Hindi-printed) | OCR handles it; Translation step treats it as source-of-truth for the fact extraction; output rendered in user's chosen locale |
| Policy is encrypted / password-protected PDF | Fail with `pdf_encrypted` — "This PDF is password-protected. Save as PDF without the password, then upload." |
| User uploaded a proposal form, not the final policy | IntakeAgent catches; "This looks like a proposal form, not the issued policy. Upload the policy document your insurer sent you." |
| User uploaded a group / corporate policy | Temporary fail: "Group policies need a bit more info. Join the waitlist for group support." |
| User uploaded ULIP / Life — not health | "This looks like a life insurance / ULIP document. Health-policy analysis only right now. Join the waitlist for life." |
| Policy > 100 pages | Reject at upload: "Please upload a policy up to 100 pages. If your policy is longer, email us and we'll help manually." |
| Policy text mentions pre-existing conditions but agent uncertain which member | Emit "needs confirmation" badge, list possible attributions |
| OCR picks up the wrong insurer name due to a broker watermark | DocumentAgent cross-checks against known-insurer DB; flags mismatch |
| User's IP address matches a known VPN / proxy | No block, but bump rate-limit tighter |
| Payment-processor timeout | N/A — this tool is free |
| User deletes cookies mid-flow | Share URL still works; cookie-less access via opaque ID is the primary model |
| Agent hallucinates a clause | ReviewAgent catches via citation verification → suppressed |
| Analysis takes > 3 minutes | Cron marks as `failed_timeout`; user sees retry option |
| Supabase Storage outage | Upload fails fast with retry; no partial state |
| Anthropic API rate-limit 429 | Trigger.dev retries with exponential backoff; analysis stays in `analysing` |

---

## 12. Success Metrics

### North star

**Share rate** — % of completed analyses whose report URL is opened by someone other than the uploader within 7 days. Direct signal of "was this useful enough to tell a family member about?"

### Leading indicators (MVP)

| Metric | Target Month 1 | Target Month 3 |
|---|---|---|
| Analyses completed / week | 50 | 500 |
| Upload → report-ready rate | ≥ 85% | ≥ 92% |
| Median time to ready | < 120s | < 90s |
| Share rate (new viewer / analysis) | ≥ 15% | ≥ 25% |
| Report PDF downloads / analysis | ≥ 20% | ≥ 30% |
| Return-visit rate within 7 days | ≥ 35% | ≥ 40% |
| Cross-tool conversion (→ Tool #2) | ≥ 10% | ≥ 20% |
| Cost per analysis (₹) | ≤ 130 | ≤ 85 |

### Quality indicators

- Agent confidence ≥ 0.7 on ≥ 80% of sections
- User-reported errors / 100 analyses < 3 (feedback button on each section)
- Red-flag precision audit (manual sampling weekly) ≥ 85%

### Anti-metrics (don't over-optimise)

- Time-on-page (a good report is scanned, not dwelled on)
- Session length (short is fine if user found the info fast)

---

## 13. Analytics & Observability

Events emitted (anonymised, no PII):

- `analyse.upload_started` — locale, file size band
- `analyse.upload_succeeded` — file size, page count, content sha
- `analyse.upload_failed` — reason code
- `analyse.intake_off_scope` — reason
- `analyse.ocr_succeeded` — duration, page count
- `analyse.ocr_failed` — reason
- `analyse.analysis_succeeded` — duration, cost_paise, confidence_overall, readiness_score
- `analyse.analysis_failed` — reason
- `analyse.report_viewed` — locale, time-since-ready
- `analyse.section_expanded` — section id, from-nav or scroll
- `analyse.pdf_downloaded`
- `analyse.shared_whatsapp`
- `analyse.deleted_by_user`
- `analyse.cross_tool_click` — coverage-check / waitlist module

Server-side observability: Sentry for errors, Supabase logs for DB, Trigger.dev dashboard for job health.

---

## 14. Open Questions

These need answers (or explicit "decide later") before we start building:

1. **OCR vendor** — Google Vision is the proposed default; worth running a 10-sample benchmark vs AWS Textract + Tesseract first week. Cost difference vs accuracy difference.
2. **Prompt caching math** — prompt cache hits only within a 5-minute window per request. We need to verify the pricing benefit assumption with a live test.
3. **Delete-now vs delete-on-share-expiry** — today's spec says user can delete immediately. Also: do we offer "extend to 30 days" when the user signs up for something? Probably yes, but out of MVP scope.
4. **Report PDF styling** — use shared brand or a more utilitarian layout? Suggest shared brand.
5. **How do we signal "I'm not sure"?** Inline orange chip vs footnote vs "verify with insurer" disclaimer. Spec says all three; pick the least noisy at design time.
6. **Urban-health-cost benchmark data** — do we ship seeded data (Phase 1: 4 cities × top 20 conditions = 80 rows) or compute from a source? Phase 1: seeded manually. Phase 2: partner or scrape.
7. **Do we allow users to click "this is wrong"?** Yes — per-section feedback button is F-125 scope. Routes to admin review queue.
8. **Accessibility** — screen reader support for the timeline visualisation in §5 — needs design thought.
9. **Support for the user to return 4 days later on a different device** — cookie-less access via opaque analysis ID URL. URL is the trust boundary. Document this clearly in the "share this link" copy.
10. **Legal review** — every red flag phrasing should be reviewed by counsel before launch. Budget time for this.

---

## 15. Proposed Implementation Phases

Week-by-week build plan. Each week is a reviewable checkpoint.

### Week 1 — Upload + storage + schema
- DB schema + RLS policies
- Upload Server Action + signed-URL flow to Supabase Storage
- Client: drag-drop + photo upload + validation
- Session-token cookie + opaque share URL
- Progress page stub (hard-coded stages)
- Analytics events for upload funnel

### Week 2 — OCR + IntakeAgent + DocumentAgent
- Google Vision integration behind the agent-sdk
- Trigger.dev workflow skeleton
- IntakeAgent (prompt + eval dataset of 20 off-scope samples)
- DocumentAgent (prompt + JSON schema + eval dataset of 20 real policies)
- Persistence layer for `policy_document.ocr_text` + `extracted`

### Week 3 — PolicyAnalyzer + the report
- PolicyAnalyzer prompt + tools (glossary lookup, red-flag patterns)
- Seeded glossary with 100 insurance terms (already partial in `@suraksha/i18n`)
- Seeded red-flag patterns for top 5 insurers
- 10-section report JSON schema
- Report page rendering (English only this week)
- Claim Readiness Score computation

### Week 4 — Translation + Review + PDF export
- TranslationAgent (Hindi + Kannada)
- ReviewAgent + suppression pipeline
- PDF export via `@react-pdf/renderer`
- WhatsApp share flow
- Delete-now + auto-expiry cron

### Week 5 — Polish + edge cases + launch
- Error-state designs
- Rate-limiting + abuse controls
- Accessibility audit
- Lighthouse ≥ 85 on the upload + report pages
- Legal review of red-flag phrasings
- Staging soak
- Beta launch to ~50 users from network (strategy-doc Day 1–30 approach)

### Week 6+ (fast-follow)
- Streaming the report as sections complete
- Q&A chat on the report
- Life-insurance extension
- Multi-policy stacking + deep-link into Policy Health Score

---

## 16. Dependencies & Risks

### Dependencies

- **Vercel + Supabase accounts** — user is provisioning; not blocking until Week 1
- **Anthropic API key** — required Week 2
- **Google Cloud project + Vision API enabled** — required Week 2
- **Trigger.dev account** — required Week 2
- **Human content editor to curate red-flag patterns** — required Week 3
- **Legal counsel to review red-flag phrasings** — required Week 5

### Key risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OCR quality on phone photos is worse than expected | High | Medium | 10-sample benchmark Week 1; switch to client-side document-scanner library if needed |
| LLM hallucinates a clause that doesn't exist | Medium | High | ReviewAgent citation verification + manual audit of first 100 analyses |
| Report is too long / users don't read it | Medium | Medium | Lead with 3-bullet summary + Claim Readiness Score; sections collapsible |
| Cost per analysis exceeds ₹130 steady-state | Low | Medium | Hard cost ceiling per analysis; prompt-cache efficiency review monthly |
| Legal exposure from a wrong analysis | Low | High | "AI assistant — verify with insurer" banner on every page; disclaimer in PDF; legal review of phrasings |
| Users upload non-health policies en masse | Medium | Low | IntakeAgent gates + waitlist for life/motor to capture demand |
| Insurer pushes back on accuracy | Low | Medium | Ground every claim in verbatim clause citation; never take policy-specific name out of its citation context |

---

## 17. Sign-off checklist

Before we commit to building:

- [ ] Product owner signs off on scope (§2) + report structure (§5)
- [ ] Engineering signs off on architecture (§6) + data model (§7) + agent design (§8)
- [ ] Content lead signs off on tone (§5) + WhatsApp-share copy
- [ ] Legal signs off on red-flag phrasings + disclaimers (§11, §13)
- [ ] Finance signs off on cost budget (§9)
- [ ] All "open questions" (§14) have an owner + a deadline

---

**End of spec. Review + comments welcome. When ready, we'll turn §15's Week-1 items into concrete tasks.**

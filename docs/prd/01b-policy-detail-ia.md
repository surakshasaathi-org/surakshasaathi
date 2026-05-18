# Policy Detail — Information Architecture

**Status:** draft — 2026-04-23
**Surface:** `/my/policies/[id]` (signed-in, owner-gated)
**Related:** `01a-analyse-my-policy.md` (the extractor/coverage pipeline that feeds this view)

## 1. Why this exists

Families don't read policies — they read *about* policies after the fact, when a claim is pending or renewal is days away. The detail view is the single surface where they can (a) verify what's actually covered, (b) find the 2-3 clauses that will bite at claim time, (c) see what applies to *each member* vs. the policy as a whole.

The previous iteration put every clause in its own card. Users reported it felt like reading a contract. The redesign groups by **clinical category** (all PED waits together, all room-rent caps together) with **semantic colour coding** (green = benefit, yellow = friction, red = exclusion trap), and a **per-member tab** for rules that hit one member specifically.

## 2. Data contract

Consumes `PolicyDetail` from `src/server/policies/detail.ts`, which wraps `ExtractorOutput` v1 with heuristic categorisation via `src/server/policies/categorise.ts` → `EnrichedExtractor`.

New extractor blocks this doc assumes (see `report-v2-types.ts`):
- `basic_facts.family_type` — `'floater' | 'individual' | 'group'`
- `basic_facts.plan_type` — `'base' | 'super_topup' | 'topup' | 'other'`
- `basic_facts.deductible_rupees` — annual deductible or super-topup threshold
- `boosters` — `no_claim_bonus`, `restore`, `inflation_protect`
- `additional_benefits[]` — structured OPD / health check-up / teleconsult / AYUSH / daily cash / organ donor / etc.
- `maternity` — delivery + newborn bundle
- `ambulance` — road + air
- `sub_limits.category` expanded with `'icu'` and `'disease_sublimit'`
- `sub_limits.proportionate_deduction` — flag used to drive room-rent danger styling

All new fields are optional. Legacy analyses that predate them render with the relevant sections empty (or suppressed — see §8).

## 3. Tabs

Two top-level tabs, sticky under the page header:

- **Overall** — policy-wide rules. Everything that applies to every member equally.
- **Per-member** (one chip per declared member) — rules that depend on that member's age, declared PEDs, or floater share.

Overall tab sections are §§4–14 below. Per-member tab structure is in §15.

## 4. Section 1 — Basics & always-applies money rules

**Intent:** the rupees a reader needs before thinking about any clause.

**Layout:** hero header already exists on the page shell. This section lives immediately below, as a 2-row metrics band:

Row 1 (foundation):
- Sum insured (primary tone)
- Deductible — rupee amount; label "Deductible" with `LearnMore term="super_topup"` that explains both senses. Hidden if `deductible_rupees` is null.
- Mandatory co-pay % (warn tone if > 0, neutral if 0/null)
- Voluntary co-pay % (only if present)

Row 2 (plan shape):
- Family type — "Floater · 4 members" / "Individual" / "Group"
- Plan type — "Base" / "Super top-up" / "Top-up"
- Period + renewal countdown (reuse existing logic)
- Network hospitals count

**Empty-state rule:** never show `—` for a fundamental field. If SI is missing, show "Not extracted" with a "Re-analyse" CTA.

## 5. Section 2 — What's covered

**Intent:** admissible claim scenarios, at a glance.

**Layout:** 2-column grid. One card per `coverage_sections[]` entry. Cards ordered by canonical weight: inpatient → daycare → pre-hosp → post-hosp → maternity → wellness → opd → other. Badge with `humanize(category)`. Summary rendered below name only when non-empty.

**No rupee amounts here** — if a coverage section has a cap, the cap lives in §7 (sub-limits); the coverage card just says "Inpatient hospitalisation" + 1-sentence summary.

## 6. Section 3 — Sum-insured boosters

**Intent:** the "good news" block. Everything that *extends* the cover you paid for.

**Tone:** green / success throughout this section (reassuring, not warning).

**Subsections:**
- **No Claim Bonus** — "+X% per claim-free year, up to Y% of SI" + "Resets on claim" / "Bonus preserved" pill. `LearnMore term="ncb"`.
- **Restore** — "Triggers on `{full_exhaustion | partial_exhaustion}`. Can restore SI for `{same | different | all}` disease, `{same | different | all}` member. `{Once per year | Unlimited}`." A 2×2 matrix visual showing disease × person axes, with the applicable cell highlighted. `LearnMore term="restore"`.
- **Inflation Protect** — "SI grows X% per year, capped at Y% of base SI" — line chart sketch (base SI → year 10 SI). `LearnMore term="inflation_protect"`.

**Empty-state rule:** if `boosters` is entirely absent, hide the section. If one of the three is absent, show a single "Not included" row for that slot rather than hiding it (readers want to know what's missing).

## 7. Section 4 — Waiting periods

**Intent:** when does cover actually kick in.

**Layout:** one yellow-tinted panel per clinical category (initial, ped, specified_disease, maternity, condition). Each panel has a group title, subtitle, `LearnMore` icon, and a list of rows. Each row: condition name + duration badge (`"Covered after X years/months/days"` via `formatWaitSpan`). Notes suppressed when they restate context (already handled via `isRedundantWaitNote`).

**Overall tab filter:** drop `'ped'` and `'condition'` — those are member-specific, shown only on member tabs.

**Member tab render:** different subtitle and only the waits matching that member's PEDs.

## 7a. Section 4a — Room & ICU eligibility (standalone)

**Intent:** surface the single-most-consequential clause — room-rent eligibility — at top level, not buried inside sub-limits. Room rent is formally a sub-limit, but operationally it's the #1 out-of-pocket surprise (proportionate-deduction trap), so it gets its own section between Basics and Boosters.

**Data source:** `sub_limits[]` filtered to `category ∈ {'room_rent', 'icu'}`.

**Layout:**
- **Room-rent hero** — green/success block with "No cap — any room" copy when all room-rent entries are unlimited; red/danger block with proportionate-deduction warning otherwise.
- **ICU cap** below hero, in a warn-tinted side block, only when present.

**`LearnMore`**: `room_rent` on header; `room_rent_proportion` inline on the hero when the cap is active; `icu_cap` on the ICU block.

## 8. Section 5 — Sub-limits & caps

**Intent:** per-procedure, per-disease, and ancillary caps INSIDE your sum insured — everything except room/ICU (which moved to §4a).

**Layout:** 2-column grid — one card per category: `procedure`, `disease_sublimit`, `modern_treatment`, `ancillary`, `other`. Each card has icon + title + subtitle + list of items (name + cap_text).

**`disease_sublimit` vs `procedure` UI distinction:**
- `procedure` card title: "Procedure caps" — subtitle "Per-procedure ceilings (cataract, hernia, knee replacement)"
- `disease_sublimit` card title: "Disease-level caps" — subtitle "Total spending ceiling per named disease, across all related procedures"

**Overall tab filter:** drop rows where `applies_to === 'condition'` (moved to member tab). Also drop `room_rent` + `icu` (handled by §4a).

## 9. Section 6 — Co-pay (conditional only)

**Intent:** co-pays that don't always apply. The "always-applies" co-pays moved up to §4 (basics).

**Subsections:**
- **Conditional** (warn tone) — age-triggered, zone-based, non-network. Each as a row: label, % badge, explanation, `LearnMore`.
- **Condition-specific** (primary tone, separate card) — one row per entry in `condition_copays[]`.

**Empty-state:** hide section if nothing conditional and no `condition_copays`.

## 10. Section 7 — Not covered (exclusions)

**Intent:** what will never be paid, period.

**Layout:** filter chips for the 6 exclusion categories with counts. Filtered list below, each row a danger-tinted strip with the verbatim exclusion text. `LearnMore` on header.

## 11. Section 8 — Additional benefits

**Intent:** claimable benefits beyond hospitalisation.

**Layout:** one card per entry in `additional_benefits[]`. Grouped visually by `kind` with distinct icons:
- `health_checkup` — stethoscope
- `teleconsult` — video icon
- `opd` — pharmacy
- `ayush` — leaf
- `mental_health` — brain
- `daily_cash` — rupees icon
- `organ_donor` — heart
- `vaccination` — syringe
- `second_opinion` — message-circle
- `wellness` / `other` — sparkle

Each card shows: icon + label + amount (if capped) or "Unlimited" + frequency + scope + members_eligible chip.

**Ambulance** rendered separately inside this section (since it feels like a practical benefit more than a "cap"): one row for road, one for air.

**Maternity** also surfaced here as a compact summary card: "Maternity cover — delivery ₹X · newborn ₹Y · N days cover · well-baby ✓/✗". Cross-links to §5 for the maternity wait.

**Empty-state:** hide if `additional_benefits` is empty/missing AND `ambulance` is null AND `maternity` is null.

## 12. Section 9 — Riders (add-on covers)

**Intent:** things the member explicitly paid extra for.

Unchanged from current build — card grid with `LearnMore term="riders"` on header.

## 12a. Section 9a — Policy-specific clauses (catch-all)

**Intent:** surface idiosyncratic benefits or rules that don't fit any structured slot. Every Indian insurer ships product-specific nuances — we don't want users to miss them because the schema was too tight.

**Data source:** `extractor.custom_clauses[]`.

**Layout:** grouped by `bucket`:
- `benefit` (green tint) — additional benefits the schema can't express
- `service` (primary tint) — concierge / partnership / second-opinion features
- `geographic` (primary tint) — global / overseas / cross-border cover
- `disease_specific` (warn tint) — illness-specific rules that aren't waits or sub-limits
- `cost_rule` (warn tint) — premium discounts, loyalty programmes, wellness incentives
- `eligibility` (warn tint) — age caps, family-composition rules
- `other` (neutral) — everything else

Each card: title (bold) + summary + optional numeric chip (`₹25,000` / `15%` / `90 days`) + `LearnMore` when a matching glossary term exists + citation link at bottom.

**Empty-state:** hide section entirely if `custom_clauses` is empty/absent.

**Why this section exists:** the rest of the IA is rigid on purpose (clinical categories, colour semantics, per-member splits). That rigour breaks down for the long tail of insurer-specific features — so this section is the pressure valve. Editorial rule for the extractor prompt: when in doubt, emit it here rather than skip it.

## 13. Section 10 — Renewal, portability, grievance

**Intent:** admin footer.

Unchanged from current build. Hide each sub-block if clause is null.

## 14. Source references (collapsible footer)

Unchanged. Grouped by section (Coverage / Exclusions / Waits / Sub-limits / Riders), each item shows `p. X · Section label` without verbatim quotes.

## 15. Per-member tab structure

Two subsections:

1. **Member-specific — from their declared conditions**
   - Waiting periods matching their PEDs (category=ped).
   - Procedure/treatment caps tied to their PEDs (sub_limit.applies_to=condition, matched against pre_existing[]).
   - Condition-specific co-pays matched against their PEDs.
   - Empty-state: "No member-specific clauses match this member's declared conditions."

2. **In addition to policy-level — also applies to them**
   - Age-triggered co-pay (if member.age ≥ from_age) — tag "Applies to this member".
   - Specified-disease waits — tag "Same as every member".
   - Room-rent cap — green if unlimited, red if capped, tag "Policy-wide · applies here".
   - NCB / Restore / Inflation protect — only if they alter member's effective SI in the floater case.

## 16. Colour semantics (locked)

| Tone | Meaning | Usage |
|------|---------|-------|
| `success` (green) | Benefit, extends cover, reassuring | Booster section, unlimited room-rent, "covered" chips |
| `warn` (yellow) | Friction rule, applies conditionally | Waits, procedure caps, conditional co-pays |
| `danger` (red) | Hard stop or cost trap | Exclusions list, room-rent with proportionate deduction |
| `primary` (terracotta) | Factual, policy-level | Basics, boosters headers, ordinary sub-limits |
| `neutral` | Filler / meta | Source references, pagination, empty states |

Every `GlanceCard`, `Badge`, and `MemberBucket` must pick from this palette. Mixing tones is a bug.

## 17. Empty-state & "Re-analyse" nudge

Schema v2 introduces fields (boosters, additional_benefits, maternity, ambulance, deductible_rupees, family_type/plan_type split, icu/disease_sublimit sub-limit categories, proportionate_deduction flag) that older analyses don't populate. Strategy:

- **Fields that gracefully degrade** (coverage_sections, waits, sub_limits, exclusions, co-pay) → render whatever's there, don't nudge.
- **Fields with a dedicated section** (boosters, additional_benefits, maternity, ambulance) → if section would be entirely empty AND analysis is older than 24h, show a single inline banner at bottom of Overall: "Some sections (boosters, extras, ambulance) aren't in this analysis. [Re-analyse for full detail]". Banner dismissible per-session.
- **Fields that changed shape** (family_type) → Zod preprocess already migrates legacy values; no UI branch needed.

## 18. Mobile behaviour

- Tab row: sticky under app header, horizontal scroll on overflow (already built).
- §4 basics: Row 1 wraps to 2×2 grid at < 640px; Row 2 wraps to 2×2 below it.
- §5 coverage: single column.
- §6 boosters, §8 sub-limits: single column, cards full-width.
- §7 co-pay, §11 additional benefits: single column.
- Source references collapsible remains full-width.
- Member tabs: chip row collapses to a horizontal-scroll strip; never a dropdown (chip visibility matters for multi-member families).

## 19. Component contracts

```ts
// src/components/my/policy-detail-view.tsx
interface Props {
  extractor: EnrichedExtractor;
  conditionSummary: ConditionSummary[];
  policyMeta: { sumAssuredPaise: number | null; premiumPaise: number | null };
}

// Internal section components (one per top-level §):
BasicsPanel({ bf, copay })
CoverageSectionsPanel({ sections })
RoomAndIcuPanel({ subLimits })                 // §4a — standalone room/ICU
BoostersPanel({ boosters })
WaitingPeriodsBlock({ waits, scope: 'overall' | 'member' })
SubLimitsBlock({ subLimits, scope })           // skips room_rent + icu
CopayBlock({ copay, scope })      // scope='overall' drops always-applies tier (moved to BasicsPanel)
ExclusionsBlock({ exclusions })
AdditionalBenefitsPanel({ benefits, ambulance, maternity })
CustomClausesPanel({ clauses })                 // §9a — policy-specific catch-all
RidersPanel({ riders })
AdminFooter({ renewal, portability, grievance })
ReAnalyseNudge({ missingSections: string[] })  // bottom-of-Overall banner

MemberPanel({ extractor, memberIndex })
SourceReferences({ extractor })
```

Each section component renders nothing (returns `null`) when its primary data is empty.

## 20. Re-use vs. rebuild

- **Re-use** as-is: `LearnMore`, glossary, `formatWaitSpan`, `isUnlimitedRoomRent`, `isRedundantWaitNote`, `groupByCategory`, `SectionHeader`, `SourceReferences`, `Member*` components.
- **Refactor** for new IA: `OverallPanel` into `BasicsPanel` + `CoverageSectionsPanel` + `BoostersPanel` + ... (was one big function).
- **New components**: `BoostersPanel` (NCB + restore matrix + inflation line), `AdditionalBenefitsPanel` (icon-per-kind grid + ambulance + maternity), `ReAnalyseNudge`.

## 21. Out of scope (parking lot)

- Printable / share-as-PDF view.
- Edit-policy-facts flow (user manually corrects an extractor mistake).
- Policy-vs-policy comparison (handled by `/my/policies/compare`).
- Claim simulator ("if I have a ₹N bill, what'll I pay out of pocket?").

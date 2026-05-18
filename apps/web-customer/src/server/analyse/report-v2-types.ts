/**
 * v2 pipeline types — output contracts for the 3-agent chain.
 *
 *   policy-extractor  → ExtractorOutput         (verbatim facts + citations)
 *   policy-coverage   → CoverageOutput          (per-member cards + must-watch items)
 *   customer-explainer → streams plain text     (no typed contract — chat)
 *
 * Old-shape `AnalysisReport` rows from the deprecated `policy-analyzer` agent keep
 * rendering via the legacy report view until their 7-day TTL expires.
 *
 * Both shapes live on `policy_analysis.report_json`; the discriminator is the
 * `version` field + presence of `member_cards` (v2) vs. `readiness_score` (v1).
 */

export type Severity = 'high' | 'medium' | 'low';

export interface Citation {
  page: number;
  section_label: string;
  /** exact quote from the policy, ≤240 chars */
  quoted_text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — policy-extractor
// ─────────────────────────────────────────────────────────────────────────────

export type CoverageCategory =
  | 'inpatient'
  | 'daycare'
  | 'pre_hospitalisation'
  | 'post_hospitalisation'
  | 'opd'
  | 'maternity'
  | 'wellness'
  | 'other';

/**
 * Citation-bearing items carry a stable `id` minted by the pipeline after
 * extractor validation. The coverage agent references clauses by this id in
 * `citation_ref`, so re-ordering between extractor versions doesn't silently
 * mis-point citations. Pre-ID items from the raw LLM output are normalised
 * to `${arrayKey}_${index}` (see mintCitationIds in pipeline.ts).
 */

export interface ExtractedCoverageSection {
  id: string;
  name: string;
  category: CoverageCategory;
  summary: string;
  citation: Citation;
}

export interface ExtractedExclusion {
  id: string;
  text: string;
  citation: Citation;
  category?: ExclusionCategory;
}

/** Clinical buckets for the waiting-period UI — five real-world categories
 *  plus an "other" overflow. Optional on the type for back-compat with
 *  pre-categorised analyses; the detail view falls back to heuristic tagging. */
export type WaitingPeriodCategory =
  | 'initial'
  | 'ped'
  | 'specified_disease'
  | 'maternity'
  | 'condition'
  | 'other';

export interface ExtractedWaitingPeriod {
  id: string;
  condition: string;
  wait_days: number | null;
  notes: string;
  citation: Citation;
  category?: WaitingPeriodCategory;
}

export type SubLimitCategory =
  | 'room_rent'
  | 'icu'
  | 'procedure'          // per-procedure caps: cataract, hernia, knee replacement
  | 'disease_sublimit'   // disease-level lump sums: cardiac, cancer, organ-total
  | 'modern_treatment'
  | 'ancillary'
  | 'other';

export interface ExtractedSubLimit {
  id: string;
  name: string;
  cap_text: string;
  citation: Citation;
  category?: SubLimitCategory;
  /** 'policy' = applies to all claims; 'condition' = only when this specific
   *  condition/treatment is involved. Drives whether it shows on a member
   *  tab as "from policy" vs tied to their own condition list. */
  applies_to?: 'policy' | 'condition';
  /** If applies_to === 'condition', the canonical condition/treatment label
   *  (lower-cased) for matching against member PEDs. */
  condition?: string;
  /** True if exceeding this cap triggers proportionate deduction across all
   *  other hospital charges. Typically set on room_rent entries. */
  proportionate_deduction?: boolean;
}

export type ExclusionCategory =
  | 'permanent'
  | 'treatments'
  | 'conditions'
  | 'behavioural'
  | 'admin'
  | 'other';

/** How the sum-insured pool is shared among members. */
export type FamilyType = 'floater' | 'individual' | 'group';

/** The plan's economic shape. `base` = premium→₹1 cover. `super_topup` =
 *  deductible-gated cover. `topup` = single-incident top-up without a
 *  cumulative threshold. */
export type PlanType = 'base' | 'super_topup' | 'topup' | 'other';

/** Additional-benefit kinds the UI can render with a specialised card. Loose
 *  enum — new kinds land here as policies surface them. */
export type AdditionalBenefitKind =
  | 'health_checkup'
  | 'teleconsult'
  | 'opd'
  | 'ayush'
  | 'mental_health'
  | 'daily_cash'
  | 'organ_donor'
  | 'vaccination'
  | 'second_opinion'
  | 'wellness'
  | 'other';

export interface ExtractorOutput {
  version: 1;
  generated_at: string;
  confidence_overall: number;
  basic_facts: {
    insurer_name: string;
    plan_name: string;
    policy_number: string;
    /** How the SI pool is shared. Legacy `plan_type` values (family_floater /
     *  individual / group) are mapped here by the Zod preprocess layer. */
    family_type: FamilyType;
    /** Economic shape of the plan. Preprocess defaults legacy rows to `base`. */
    plan_type: PlanType;
    /** Integer rupees (NOT paise). See `normaliseRupees()` — legacy paise
     *  values are auto-corrected at write time. */
    sum_insured_rupees: number | null;
    premium_rupees: number | null;
    /** Annual deductible or super-topup trigger threshold, in rupees. Same
     *  field covers both semantically; UI labels it "Deductible" with a
     *  glossary entry that explains both senses. */
    deductible_rupees?: number | null;
    period_start: string | null;
    period_end: string | null;
    members: Array<{ relation: string; age: number | null; pre_existing: string[] }>;
    /** Person who bought the policy on behalf of the insured. May or may not
     *  also be insured. NEVER counted in `members[]` unless explicitly listed
     *  as insured on the schedule. */
    proposer_name?: string | null;
    proposer_relation_to_insured?: string | null;
    nominee_name: string | null;
    nominee_relation: string | null;
    network_hospital_count: number | null;
  };
  coverage_sections: ExtractedCoverageSection[];
  exclusions: ExtractedExclusion[];
  waiting_periods: ExtractedWaitingPeriod[];
  sub_limits: ExtractedSubLimit[];
  /**
   * Co-pay shape handles every real-world variant:
   *   Policy-level (always applies):  voluntary_percentage, mandatory_percentage, deductible_rupees
   *   Policy-level (conditional):     age_triggered, non_network_percentage, zone_based
   *   Condition/treatment-specific:   condition_copays[]
   * The new fields are optional so existing v2 rows continue to parse.
   */
  copay: {
    voluntary_percentage: number | null;
    mandatory_percentage: number | null;
    age_triggered: { from_age: number; percentage: number } | null;
    deductible_rupees: number | null;
    /** Co-pay % that kicks in when treated at a non-network hospital. */
    non_network_percentage?: number | null;
    /** Zone-based co-pay: description + per-zone breakdown when available. */
    zone_based?: {
      description: string;
      zones?: Array<{ zone: string; copay_percentage: number }>;
    } | null;
    /** Condition- or treatment-specific co-pays. Each entry is a rule that
     *  applies only when the insured is being treated for this condition
     *  (e.g. "20% co-pay on cataract surgery"). */
    condition_copays?: Array<{
      condition_or_treatment: string;
      percentage: number;
      notes?: string;
      citation: Citation;
    }>;
    explanation: string;
    citation: Citation | null;
  };
  /** Sum-insured boosters: the "good news" block — rules that EXTEND cover. */
  boosters?: {
    no_claim_bonus?: {
      per_year_percentage: number;
      max_percentage: number;
      resets_on_claim: boolean;
      notes?: string;
      citation?: Citation | null;
    } | null;
    /** Restore / Refill / Reinstatement. `disease` and `person` axes capture
     *  the four combinations every policy describes. */
    restore?: {
      trigger: 'full_exhaustion' | 'partial_exhaustion';
      /** Can restored SI be used for the SAME disease that exhausted it, for
       *  a DIFFERENT disease, or ALL illnesses regardless? */
      disease: 'same' | 'different' | 'all';
      /** Can the SAME person use the restored SI again, only OTHER family
       *  members, or ALL members of the floater? */
      person: 'same' | 'different' | 'all';
      frequency: 'once_per_year' | 'unlimited';
      notes?: string;
      citation?: Citation | null;
    } | null;
    inflation_protect?: {
      per_year_percentage: number;
      max_percentage?: number | null;
      notes?: string;
      citation?: Citation | null;
    } | null;
  };
  /** Structured "additional benefits" — free check-ups, OPD, teleconsult,
   *  AYUSH, daily cash, etc. Each is a concrete benefit the user can claim
   *  during the policy year, separate from hospitalisation coverage. */
  additional_benefits?: Array<{
    id: string;
    kind: AdditionalBenefitKind;
    label: string;
    amount_rupees?: number | null;
    frequency?: string | null;
    scope?: string | null;
    members_eligible?: 'all' | 'adults' | 'children' | 'senior' | null;
    notes?: string;
    citation?: Citation | null;
  }>;
  /** Maternity bundle — pulled out separately because waits + caps + newborn
   *  cover + well-baby check-up span multiple other sections otherwise. */
  maternity?: {
    covered: boolean;
    delivery_cap_rupees?: number | null;
    newborn_cover_days?: number | null;
    newborn_cap_rupees?: number | null;
    well_baby_checkup?: boolean;
    notes?: string;
    citation?: Citation | null;
  } | null;
  /** Ambulance split — road vs air, per-event vs annual cap. Lifted out of
   *  `sub_limits` ancillary for clarity. */
  ambulance?: {
    road_cap_rupees?: number | null;
    air_cap_rupees?: number | null;
    per_event_or_annual?: 'per_event' | 'annual' | null;
    notes?: string;
    citation?: Citation | null;
  } | null;
  riders: Array<{ name: string; summary: string; citation: Citation }>;
  renewal_and_portability: {
    renewal_clause: string | null;
    portability_clause: string | null;
    citations: Citation[];
  };
  grievance_contacts: {
    insurer_grievance: string | null;
    ombudsman: string | null;
    tpa: string | null;
  };
  /** Catch-all for policy-specific clauses that don't fit any typed slot.
   *  Every Indian insurer has idiosyncratic benefits, conditions, or
   *  carve-outs — we surface them here rather than silently drop them.
   *  Rendered on the detail view as a "Policy-specific clauses" section. */
  custom_clauses?: Array<{
    id: string;
    /** Short insurer-surfaced title (e.g. "Second medical opinion — LIVE"). */
    title: string;
    /** 1-3 sentence plain-English summary. */
    summary: string;
    /** Loose classifier to help the UI group similar customs. Use one of the
     *  known buckets when possible; fall back to 'other'. */
    bucket?:
      | 'benefit'
      | 'cost_rule'
      | 'eligibility'
      | 'service'
      | 'geographic'
      | 'disease_specific'
      | 'other';
    /** If the clause involves a rupee cap, frequency, or %, capture it here. */
    numeric_value?: number | null;
    /** Unit for numeric_value — "rupees" | "%" | "days" | "visits" | etc. */
    numeric_unit?: string | null;
    notes?: string;
    citation?: Citation | null;
  }>;
  unknown_fields: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// User-supplied demographics (supplemental form)
// ─────────────────────────────────────────────────────────────────────────────

export interface DemographicsInput {
  /** free-form members entered by the user — may overlap / differ from the policy's member list */
  members: Array<{
    ref: string; // 'self' | 'spouse' | 'child_1' | 'parent_mother' | ... | custom
    age: number;
    display_label: string;
    pre_existing?: string[];
    chronic_meds?: string[];
    notes?: string;
  }>;
  life_events?: string[]; // 'marriage', 'childbirth', 'parent_moved_in', ...
  household_city?: string;
  locale: 'en' | 'hi' | 'kn';
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — policy-coverage
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberCardItem {
  title: string;
  detail: string;
  /** Optional list of discrete sub-facts for items that are easier to read as
   *  bullets than a paragraph. Example: pre-hospitalisation 30d + post 60d +
   *  10% cap → three bullets, with `detail` keeping a one-line gist. */
  bullets?: string[];
  citation_ref: string; // resolves to ExtractorOutput.coverage_sections[*] or exclusions[*]
}

export interface MemberConditionalItem extends MemberCardItem {
  condition: string;
}

export interface MemberMustWatchItem {
  title: string;
  severity: Severity;
  why_it_matters: string;
  citation_ref: string;
}

export interface MemberCard {
  member_ref: string;
  display_label: string;
  what_is_covered: MemberCardItem[];
  what_is_not_covered: MemberCardItem[];
  conditional_coverage: MemberConditionalItem[];
  must_watch_items: MemberMustWatchItem[];
}

export interface FamilyLevelNote {
  title: string;
  detail: string;
  citation_refs: string[];
}

export interface CoverageRedFlag {
  title: string;
  why_it_matters: string;
  severity: Severity;
  citation_ref: string;
  action: string;
}

export interface CoverageActionItem {
  title: string;
  why: string;
  how: string;
  urgency: 'do_today' | 'do_this_month' | 'optional';
}

/**
 * A specific question the user should ask the insurer because the document
 * itself doesn't answer it. Distinct from a red flag — these are NOT problems
 * with the policy, they're gaps in our information about the policy. The
 * coverage agent emits these instead of speculating about "industry-typical"
 * values. See policy-coverage system prompt §"No speculation".
 */
export interface CoverageClarification {
  /** What's missing from the document, in plain language. */
  question: string;
  /** Why this matters for THIS user (their members, their PEDs, their plan). */
  why_it_matters: string;
  /** The exact question the user should put to the insurer / TPA. */
  ask_the_insurer: string;
  /** How critical is the gap. */
  severity: Severity;
}

export interface CoverageOutput {
  version: 2;
  generated_at: string;
  locale: 'en' | 'hi' | 'kn';
  confidence_overall: number;
  quick_summary: string;
  member_cards: MemberCard[];
  family_level_notes: FamilyLevelNote[];
  red_flags: CoverageRedFlag[];
  /** Things the document does NOT state — to clarify with the insurer.
   *  Optional in the type so legacy CoverageOutput objects (pre-2026-05-03)
   *  load without breaking. New runs always populate (possibly empty). */
  clarifications_needed?: CoverageClarification[];
  what_to_do_now: CoverageActionItem[];
  pii_warning: string;
  disclaimer: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite v2 report stored on policy_analysis.report_json
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportV2 {
  version: 2;
  extractor: ExtractorOutput;
  /**
   * Coverage is optional because partial failure must still yield a viewable
   * report. When null, the UI shows an "extractor succeeded, coverage failed"
   * fallback and lets the user retry just the coverage step.
   */
  coverage: CoverageOutput | null;
}

/**
 * Structural discriminator between legacy v1 AnalysisReport rows and new v2
 * ReportV2 rows stored on the same `report_json` column. Intentionally
 * lightweight — a full Zod re-validation runs at the pipeline boundary; this
 * just picks which renderer to hand off to. If `version !== 2` or the required
 * extractor substructure is missing, fall back to the v1 renderer (which is
 * similarly defensive about malformed input).
 */
export function isReportV2(raw: unknown): raw is ReportV2 {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (o.version !== 2) return false;
  const extractor = o.extractor;
  if (!extractor || typeof extractor !== 'object') return false;
  const ex = extractor as Record<string, unknown>;
  return (
    typeof ex.basic_facts === 'object' &&
    Array.isArray(ex.coverage_sections) &&
    Array.isArray(ex.exclusions)
  );
}

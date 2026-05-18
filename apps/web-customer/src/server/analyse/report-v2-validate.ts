import { z } from 'zod';
import type { CoverageOutput, ExtractorOutput } from './report-v2-types';

/**
 * Zod schemas for the v2 pipeline outputs. The LLM is instructed to emit JSON
 * conforming to these shapes; if it drifts (missing keys, wrong types) we
 * detect it at the pipeline boundary instead of crashing the UI downstream.
 *
 * Strict on types + required structure, lenient on optional wordings — we
 * keep `strict: false` at the object level so the agent can add helpful
 * ancillary fields without breaking the pipeline.
 */

/** Citation — tolerant of the LLM occasionally omitting or nulling fields.
 *  Coerces to safe defaults (page 0, empty labels) rather than failing the
 *  whole extractor output on a missing page number. */
const CitationSchema = z.object({
  page: z.number().nullable().default(0).transform((v) => v ?? 0),
  section_label: z.string().nullable().default('').transform((v) => v ?? ''),
  quoted_text: z.string().max(2000).nullable().default('').transform((v) => v ?? ''),
});

/**
 * Category fields are deliberately loose strings, not Zod enums. Every
 * insurer uses its own terminology — enforcing a closed enum at the
 * validator layer mis-rejects real outputs. Downstream heuristic code
 * (`server/policies/categorise.ts`) maps free-text categories into the
 * canonical buckets the UI + scorer consume.
 */
const CoverageCategorySchema = z.string().nullable().default('other').transform((v) => v ?? 'other');

export const ExtractorOutputSchema = z.object({
  version: z.literal(1),
  // generated_at is a timestamp the agent emits; don't fail the pipeline if
  // the LLM skips it — backfill with now() after validation succeeds.
  generated_at: z.string().nullable().default(() => new Date().toISOString()).transform((v) => v ?? new Date().toISOString()),
  // Clamp confidence to [0,1]; coerce null → 0.5 (middle-ground default).
  confidence_overall: z.number().min(0).max(1).nullable().default(0.5).transform((v) => v ?? 0.5),
  basic_facts: z.preprocess(
    (raw) => {
      // Migrate legacy keys:
      //   - `*_paise` → `*_rupees` (the rupees contract, normaliseRupees catches
      //     paise slips at insert time).
      //   - Old `plan_type` held family-sharing info ('family_floater' |
      //     'individual' | 'group' | 'other'). Split it: those values move to
      //     the new `family_type`, and `plan_type` defaults to 'base' unless
      //     the caller has already supplied a new-shape plan_type value.
      if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>;
        if (r.sum_insured_rupees == null && 'sum_assured_paise' in r) {
          r.sum_insured_rupees = r.sum_assured_paise;
        }
        if (r.premium_rupees == null && 'premium_paise' in r) {
          r.premium_rupees = r.premium_paise;
        }
        const legacyPlanType = r.plan_type;
        const newPlanTypeValues = new Set(['base', 'super_topup', 'topup', 'other']);
        if (typeof legacyPlanType === 'string' && !newPlanTypeValues.has(legacyPlanType)) {
          // Legacy value — move it to family_type.
          if (r.family_type == null) {
            if (legacyPlanType === 'family_floater') r.family_type = 'floater';
            else if (legacyPlanType === 'individual') r.family_type = 'individual';
            else if (legacyPlanType === 'group') r.family_type = 'group';
            else r.family_type = 'individual'; // sensible default for 'other'
          }
          r.plan_type = 'base';
        }
        if (r.family_type == null) r.family_type = 'individual';
        if (r.plan_type == null) r.plan_type = 'base';
      }
      return raw;
    },
    z.object({
    insurer_name: z.string().nullable().default(''),
    plan_name: z.string().nullable().default(''),
    policy_number: z.string().nullable().default(''),
    // Loose strings; UI/scorer normalise. 'individual' / 'floater' / 'group'
    // for family_type and 'base' / 'super_topup' / 'topup' / 'other' for
    // plan_type are the canonical values, but insurers use variants like
    // 'family_floater', 'super-top-up', 'individual + spouse' — accept all.
    family_type: z.string().nullable().default('individual').transform((v) => v ?? 'individual'),
    plan_type: z.string().nullable().default('base').transform((v) => v ?? 'base'),
    // Stored as integer rupees (not paise). Legacy paise values (> 5 Cr rupees)
    // are auto-normalised in `normaliseRupees()` before persistence — older
    // analyses that still emit `_paise`-named fields will pass through too.
    sum_insured_rupees: z.number().nullable(),
    premium_rupees: z.number().nullable(),
    deductible_rupees: z.number().nullable().optional(),
    period_start: z.string().nullable(),
    period_end: z.string().nullable(),
    members: z
      .array(
        z.object({
          relation: z.string().nullable().default(''),
          age: z.number().nullable(),
          pre_existing: z.array(z.string()).nullable().default([]).transform((v) => v ?? []),
        }),
      )
      .nullable()
      .default([])
      .transform((v) => v ?? []),
    // Optional + nullable for backwards compatibility — legacy reports
    // pre-2026-05-04 won't have these fields.
    proposer_name: z.string().nullable().optional(),
    proposer_relation_to_insured: z.string().nullable().optional(),
    nominee_name: z.string().nullable(),
    nominee_relation: z.string().nullable(),
    network_hospital_count: z.number().nullable(),
    }),
  ),
  // `id` is minted by the pipeline after validation, so it's optional here.
  // Every array defaults to `[]` when the LLM omits the key or sends null —
  // downstream code already handles empty arrays gracefully, so there's no
  // reason to fail the whole pipeline on a missing section.
  coverage_sections: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().nullable().default(''),
        category: CoverageCategorySchema,
        summary: z.string().nullable().default(''),
        citation: CitationSchema,
      }),
    )
    .nullable()
    .default([])
    .transform((v) => v ?? []),
  exclusions: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string().nullable().default(''),
        citation: CitationSchema,
        category: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .default([])
    .transform((v) => v ?? []),
  waiting_periods: z
    .array(
      z.object({
        id: z.string().optional(),
        condition: z.string().nullable().default(''),
        wait_days: z.number().nullable(),
        notes: z.string().nullable().default(''),
        citation: CitationSchema,
        category: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .default([])
    .transform((v) => v ?? []),
  sub_limits: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().nullable().default(''),
        cap_text: z.string().nullable().default(''),
        citation: CitationSchema,
        category: z.string().nullable().optional(),
        applies_to: z.string().nullable().optional(),
        condition: z.string().nullable().optional(),
        proportionate_deduction: z.boolean().nullable().optional(),
      }),
    )
    .nullable()
    .default([])
    .transform((v) => v ?? []),
  copay: z.preprocess(
    (raw) => {
      if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>;
        // Legacy field migration.
        if (r.deductible_rupees == null && 'deductible_paise' in r) {
          r.deductible_rupees = r.deductible_paise;
        }
        // Some agent outputs omit `deductible_rupees` entirely when there is
        // no deductible. Normalise to null so the `.nullable()` schema holds.
        if (!('deductible_rupees' in r)) r.deductible_rupees = null;
      }
      return raw;
    },
    z.object({
    voluntary_percentage: z.number().nullable(),
    mandatory_percentage: z.number().nullable(),
    age_triggered: z.object({ from_age: z.number(), percentage: z.number() }).nullable(),
    deductible_rupees: z.number().nullable(),
    // Newer optional fields — legacy rows pre-date them and still validate.
    non_network_percentage: z.number().nullable().optional(),
    zone_based: z
      .object({
        description: z.string(),
        zones: z
          .array(z.object({ zone: z.string(), copay_percentage: z.number() }))
          .optional(),
      })
      .nullable()
      .optional(),
    condition_copays: z
      .array(
        z.object({
          condition_or_treatment: z.string(),
          percentage: z.number(),
          notes: z.string().nullable().optional(),
          citation: CitationSchema,
        }),
      )
      .optional(),
    explanation: z.string().nullable().default(''),
    citation: CitationSchema.nullable(),
    }),
  ),
  // ── New structured blocks (all optional; legacy rows validate without them). ──
  boosters: z
    .object({
      no_claim_bonus: z
        .object({
          per_year_percentage: z.number(),
          max_percentage: z.number(),
          resets_on_claim: z.boolean(),
          notes: z.string().nullable().optional(),
          citation: CitationSchema.nullable().optional(),
        })
        .nullable()
        .optional(),
      restore: z
        .object({
          // Preferred values are documented in the prompt; accept any string
          // so variant wording ('full exhaustion', 'on exhaustion', etc.)
          // doesn't reject the whole analysis. Downstream scorer normalises.
          trigger: z.string().nullable().optional(),
          disease: z.string().nullable().optional(),
          person: z.string().nullable().optional(),
          frequency: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
          citation: CitationSchema.nullable().optional(),
        })
        .nullable()
        .optional(),
      inflation_protect: z
        .object({
          per_year_percentage: z.number(),
          max_percentage: z.number().nullable().optional(),
          notes: z.string().nullable().optional(),
          citation: CitationSchema.nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .optional(),
  additional_benefits: z
    .array(
      z.object({
        id: z.string().optional(),
        // Free-form kind — insurers name benefits differently (health_checkup,
        // "preventive check", annual_screening). Downstream heuristic maps
        // whatever string comes in to the canonical `AdditionalBenefitKind`.
        kind: z.string().nullable().default('other').transform((v) => v ?? 'other'),
        label: z.string().nullable().default(''),
        amount_rupees: z.number().nullable().optional(),
        frequency: z.string().nullable().optional(),
        scope: z.string().nullable().optional(),
        members_eligible: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        citation: CitationSchema.nullable().optional(),
      }),
    )
    .optional(),
  maternity: z
    .object({
      covered: z.boolean(),
      delivery_cap_rupees: z.number().nullable().optional(),
      newborn_cover_days: z.number().nullable().optional(),
      newborn_cap_rupees: z.number().nullable().optional(),
      well_baby_checkup: z.boolean().optional(),
      notes: z.string().nullable().optional(),
      citation: CitationSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  ambulance: z
    .object({
      road_cap_rupees: z.number().nullable().optional(),
      air_cap_rupees: z.number().nullable().optional(),
      per_event_or_annual: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      citation: CitationSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  riders: z
    .array(
      z.object({
        name: z.string().nullable().default(''),
        summary: z.string().nullable().default(''),
        citation: CitationSchema,
      }),
    )
    .nullable()
    .default([])
    .transform((v) => v ?? []),
  // `renewal_and_portability` and `grievance_contacts` are both sometimes emitted
  // as `null` by the LLM when the document has neither clause. Coerce the null
  // to the "all fields null" shape rather than fail validation.
  renewal_and_portability: z
    .object({
      renewal_clause: z.string().nullable(),
      portability_clause: z.string().nullable(),
      citations: z.array(CitationSchema).nullable().default([]).transform((v) => v ?? []),
    })
    .nullable()
    .transform((v) => v ?? { renewal_clause: null, portability_clause: null, citations: [] }),
  custom_clauses: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().nullable().default(''),
        summary: z.string().nullable().default(''),
        // Bucket is advisory — downstream renderer treats unknown buckets as 'other'.
        bucket: z.string().nullable().optional(),
        numeric_value: z.number().nullable().optional(),
        numeric_unit: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        citation: CitationSchema.nullable().optional(),
      }),
    )
    .nullable()
    .default([])
    .transform((v) => v ?? []),
  grievance_contacts: z
    .object({
      insurer_grievance: z.string().nullable(),
      ombudsman: z.string().nullable(),
      tpa: z.string().nullable(),
    })
    .nullable()
    .transform((v) => v ?? { insurer_grievance: null, ombudsman: null, tpa: null }),
  unknown_fields: z.array(z.string()).nullable().default([]).transform((v) => v ?? []),
});

const SeveritySchema = z.enum(['high', 'medium', 'low']);
const UrgencySchema = z.enum(['do_today', 'do_this_month', 'optional']);

const MemberCardItemSchema = z.object({
  title: z.string(),
  detail: z.string(),
  // Optional list of discrete sub-facts for multi-point coverage items.
  bullets: z.array(z.string()).optional(),
  citation_ref: z.string(),
});

export const CoverageOutputSchema = z.object({
  version: z.literal(2),
  generated_at: z.string(),
  locale: z.enum(['en', 'hi', 'kn']),
  confidence_overall: z.number().min(0).max(1),
  quick_summary: z.string(),
  member_cards: z.array(
    z.object({
      member_ref: z.string(),
      display_label: z.string(),
      what_is_covered: z.array(MemberCardItemSchema),
      what_is_not_covered: z.array(MemberCardItemSchema),
      conditional_coverage: z.array(MemberCardItemSchema.extend({ condition: z.string() })),
      must_watch_items: z.array(
        z.object({
          title: z.string(),
          severity: SeveritySchema,
          why_it_matters: z.string(),
          citation_ref: z.string(),
        }),
      ),
    }),
  ),
  family_level_notes: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      citation_refs: z.array(z.string()),
    }),
  ),
  red_flags: z.array(
    z.object({
      title: z.string(),
      why_it_matters: z.string(),
      severity: SeveritySchema,
      citation_ref: z.string(),
      action: z.string(),
    }),
  ),
  // Optional for backwards compatibility with pre-2026-05-03 coverage rows
  // already in the DB. New runs always populate (may be []).
  clarifications_needed: z
    .array(
      z.object({
        question: z.string(),
        why_it_matters: z.string(),
        ask_the_insurer: z.string(),
        severity: SeveritySchema,
      }),
    )
    .optional()
    .default([]),
  what_to_do_now: z.array(
    z.object({
      title: z.string(),
      why: z.string(),
      how: z.string(),
      urgency: UrgencySchema,
    }),
  ),
  pii_warning: z.string(),
  disclaimer: z.string(),
});

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[]; preview: string };

export function validateExtractorOutput(raw: unknown): ValidationResult<ExtractorOutput> {
  const parsed = ExtractorOutputSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data as ExtractorOutput };
  return {
    ok: false,
    errors: parsed.error.errors.slice(0, 5).map((e) => `${e.path.join('.')}: ${e.message}`),
    preview: safePreview(raw),
  };
}

export function validateCoverageOutput(raw: unknown): ValidationResult<CoverageOutput> {
  const parsed = CoverageOutputSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data as CoverageOutput };
  return {
    ok: false,
    errors: parsed.error.errors.slice(0, 5).map((e) => `${e.path.join('.')}: ${e.message}`),
    preview: safePreview(raw),
  };
}

function safePreview(raw: unknown): string {
  if (raw && typeof raw === 'object') return JSON.stringify(raw).slice(0, 300);
  return String(raw).slice(0, 300);
}

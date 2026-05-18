import 'server-only';
import type {
  ExclusionCategory,
  ExtractedExclusion,
  ExtractedSubLimit,
  ExtractedWaitingPeriod,
  ExtractorOutput,
  SubLimitCategory,
  WaitingPeriodCategory,
} from '@/server/analyse/report-v2-types';

/**
 * Heuristic categoriser — bucket the extractor's flat arrays into clinically-
 * meaningful categories when the agent didn't tag them itself. Runs once on
 * the server before the detail view renders. If/when the extractor prompt
 * starts emitting categories directly, this module becomes a pure passthrough.
 *
 * Design note: when agent-tagged categories are present we trust them;
 * heuristics only fill gaps. Keeps us forward-compatible.
 */

export interface EnrichedExtractor extends Omit<ExtractorOutput, 'waiting_periods' | 'sub_limits' | 'exclusions'> {
  waiting_periods: Array<Required<Pick<ExtractedWaitingPeriod, 'category'>> & ExtractedWaitingPeriod>;
  sub_limits: Array<Required<Pick<ExtractedSubLimit, 'category' | 'applies_to'>> & ExtractedSubLimit>;
  exclusions: Array<Required<Pick<ExtractedExclusion, 'category'>> & ExtractedExclusion>;
}

export function enrichExtractor(e: ExtractorOutput): EnrichedExtractor {
  return {
    ...e,
    waiting_periods: e.waiting_periods.map((w) => ({
      ...w,
      category: w.category ?? categoriseWait(w),
    })),
    sub_limits: e.sub_limits.map((s) => ({
      ...s,
      category: s.category ?? categoriseSubLimit(s),
      applies_to: s.applies_to ?? (categoriseSubLimit(s) === 'procedure' ? 'condition' : 'policy'),
    })),
    exclusions: e.exclusions.map((x) => ({
      ...x,
      category: x.category ?? categoriseExclusion(x),
    })),
  };
}

/* ───────── Waiting period heuristics ───────── */

const SPECIFIED_DISEASE_KEYWORDS = [
  'cataract',
  'hernia',
  'hysterectomy',
  'fissure',
  'piles',
  'fistula',
  'knee replacement',
  'joint replacement',
  'stones',
  'kidney stone',
  'gall bladder',
  'tonsil',
  'adenoid',
  'sinusitis',
  'benign tumor',
  'benign tumour',
  'congenital',
];

function categoriseWait(w: ExtractedWaitingPeriod): WaitingPeriodCategory {
  const c = w.condition.toLowerCase();
  const notes = (w.notes ?? '').toLowerCase();
  const both = `${c} ${notes}`;

  if (/\binitial\b|\b30[\s-]?day|\bfirst 30\b/.test(both) && (w.wait_days ?? 0) <= 60) {
    return 'initial';
  }
  if (/pre[\s-]?existing|\bped\b|declared condition/.test(both)) return 'ped';
  if (/maternity|childbirth|pregnan|newborn|c[\s-]?section/.test(both)) return 'maternity';
  if (/specified disease|named (condition|ailment)/.test(both)) return 'specified_disease';
  if (SPECIFIED_DISEASE_KEYWORDS.some((k) => c.includes(k))) return 'specified_disease';
  // Anything else that names a specific condition → 'condition'; otherwise 'other'.
  return c.length > 0 ? 'condition' : 'other';
}

/* ───────── Sub-limit heuristics ───────── */

const MODERN_TREATMENT_KEYWORDS = [
  'robotic',
  'oral chemo',
  'stem cell',
  'immunotherapy',
  'balloon sinu',
  'deep brain',
  'uterine artery',
  'hiv ',
  'osteo',
  'bronchial thermo',
  'intravitreal',
];
const ANCILLARY_KEYWORDS = [
  'ambulance',
  'pre[-\\s]?hospital',
  'post[-\\s]?hospital',
  'day[-\\s]?care',
  'domiciliary',
  'nursing',
  'consultation',
];
/** Disease-level aggregate caps — sum across multiple procedures for one
 *  illness. Distinct from `procedure` which is per-procedure. */
const DISEASE_SUBLIMIT_KEYWORDS = [
  'cardiac',
  'cardiovascular',
  'coronary',
  'cancer',
  'oncolog',
  'chemotherapy',
  'radiation',
  'organ failure',
  'renal',
  'joint replacement',
];
const PROCEDURE_HINTS = [
  ...SPECIFIED_DISEASE_KEYWORDS,
  'surgery',
  'replacement',
  'transplant',
  'bypass',
  'stent',
  'angioplasty',
];

function categoriseSubLimit(s: ExtractedSubLimit): SubLimitCategory {
  const n = s.name.toLowerCase();
  const cap = s.cap_text.toLowerCase();
  const both = `${n} ${cap}`;

  if (/room[\s-]?rent|room\s*&?\s*boarding|bed charge|room category/.test(both)) return 'room_rent';
  if (/\bicu\b|intensive care/.test(both)) return 'icu';
  if (MODERN_TREATMENT_KEYWORDS.some((k) => both.includes(k))) return 'modern_treatment';
  // Disease-level lump sum beats procedure match — a "cardiac sub-limit" is a
  // disease cap, not a per-procedure cap, even though it contains disease words.
  if (DISEASE_SUBLIMIT_KEYWORDS.some((k) => both.includes(k)) && /(aggregate|overall|total|limit|cap|sub[-\s]?limit)/.test(both)) {
    return 'disease_sublimit';
  }
  if (new RegExp(ANCILLARY_KEYWORDS.join('|')).test(both)) return 'ancillary';
  if (PROCEDURE_HINTS.some((k) => both.includes(k))) return 'procedure';
  return 'other';
}

/* ───────── Exclusion heuristics ───────── */

function categoriseExclusion(x: ExtractedExclusion): ExclusionCategory {
  const t = x.text.toLowerCase();
  if (/\bwar\b|\bnuclear\b|terror|riot|suicide|cosmetic|beautification/.test(t)) return 'permanent';
  if (/ayush|homeopath|naturopath|unani|ayurved|experimental|investigational|unproven/.test(t)) {
    return 'treatments';
  }
  if (/dental|eye (care|test|glass)|spectacle|hearing aid|non-allopath/.test(t)) return 'conditions';
  if (/intoxicat|alcohol|drug abuse|self[\s-]?inflict|narcot|substance/.test(t)) return 'behavioural';
  if (/fraud|misrepresent|non[\s-]?disclosure|concealment/.test(t)) return 'admin';
  return 'other';
}

/* ───────── By-condition summary ───────── */

export interface ConditionSummary {
  key: string;          // canonical lowercase match key
  display: string;      // "Cataract"
  waitDays: number | null;
  caps: string[];       // ["₹40,000 cap"]
  copayPercentage: number | null;
  citations: Array<{ page: number; section_label: string }>;
  notes: string[];
  /** false if any backing entry is a ped-category wait — those are member-
   *  specific and should only surface on the member tab, not Overall. */
  policyWide: boolean;
}

/**
 * Build a unified "By condition" table: for every specific condition named
 * anywhere in waits, sub-limits, or condition_copays, stitch them into one
 * row so the user sees the full picture for e.g. "cataract" in one place.
 *
 * Matching is case-insensitive substring — rough but it handles "Cataract",
 * "cataract surgery", "cataract (both eyes)" as the same key.
 */
export function buildConditionSummary(e: EnrichedExtractor): ConditionSummary[] {
  const bySlug = new Map<string, ConditionSummary>();

  const canon = (s: string) => s.trim().toLowerCase();
  const titleCase = (s: string) =>
    s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  function slot(rawName: string): ConditionSummary {
    const key = canon(rawName);
    let s = bySlug.get(key);
    if (!s) {
      s = {
        key,
        display: titleCase(rawName),
        waitDays: null,
        caps: [],
        copayPercentage: null,
        citations: [],
        notes: [],
        policyWide: true,
      };
      bySlug.set(key, s);
    }
    return s;
  }

  // Waits: include only condition-level + specified_disease + ped (one-off
  // condition-named rows). Skip the generic 'initial' / 'maternity' buckets.
  for (const w of e.waiting_periods) {
    if (w.category !== 'condition' && w.category !== 'specified_disease' && w.category !== 'ped') {
      continue;
    }
    const row = slot(w.condition);
    if (w.wait_days != null && (row.waitDays == null || w.wait_days > row.waitDays)) {
      row.waitDays = w.wait_days;
    }
    if (w.notes) row.notes.push(w.notes);
    row.citations.push({ page: w.citation.page, section_label: w.citation.section_label });
    // PED waits are tied to a specific member's declaration — flag the row
    // so Overall can filter them out (they belong in member tabs).
    if (w.category === 'ped') row.policyWide = false;
  }

  // Condition-named sub-limits (procedure caps, modern treatments).
  for (const s of e.sub_limits) {
    if (s.applies_to !== 'condition') continue;
    const name = s.condition ?? s.name;
    const row = slot(name);
    row.caps.push(s.cap_text);
    row.citations.push({ page: s.citation.page, section_label: s.citation.section_label });
  }

  // Condition-specific copays.
  for (const c of e.copay.condition_copays ?? []) {
    const row = slot(c.condition_or_treatment);
    row.copayPercentage = c.percentage;
    if (c.notes) row.notes.push(c.notes);
    row.citations.push({ page: c.citation.page, section_label: c.citation.section_label });
  }

  // Sort: rows with waits first (usually biggest deal), then caps, then copays.
  return Array.from(bySlug.values()).sort((a, b) => {
    const aScore =
      (a.waitDays != null ? 1000 : 0) + a.caps.length * 10 + (a.copayPercentage != null ? 1 : 0);
    const bScore =
      (b.waitDays != null ? 1000 : 0) + b.caps.length * 10 + (b.copayPercentage != null ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;
    return a.display.localeCompare(b.display);
  });
}

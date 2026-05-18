/**
 * Pure helpers for rendering + classifying policy-analysis facts.
 *
 * Shared between UI components (policy-detail-view, readiness card) and
 * server code (scoring module). Intentionally dependency-free so scorers
 * can consume it without reaching into React surface.
 */

/**
 * Render a wait duration as "when does it get covered" — e.g. 1095 days →
 * "Covered after 3 years", 90 → "Covered after 3 months", 30 → "Covered after
 * 30 days". For uneven spans we fall back to the longer unit.
 */
export function formatWaitSpan(days: number): string {
  if (days <= 0) return 'Covered from day 1';
  if (days < 60) return `Covered after ${days} day${days === 1 ? '' : 's'}`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `Covered after ${months} month${months === 1 ? '' : 's'}`;
  }
  const years = days / 365;
  if (Number.isInteger(years) || Math.abs(years - Math.round(years)) < 0.02) {
    const y = Math.round(years);
    return `Covered after ${y} year${y === 1 ? '' : 's'}`;
  }
  const months = Math.round(days / 30);
  return `Covered after ${months} months`;
}

/**
 * True when a cap_text string represents "no restriction on room" — e.g.
 * "No limit", "Unlimited", "At actuals", "Any room (except suite)". Drives
 * the green/reassuring room-rent treatment on the detail view + full-marks
 * on the scorer.
 */
export function isUnlimitedRoomRent(text: string): boolean {
  return isEffectivelyUnlimited(text) || isRoomRentUnlimitedShape(text);
}

/**
 * Broader "no meaningful cap" check used for sub-limits, boosters, benefits.
 * Returns true when the cap_text effectively says "the whole sum insured is
 * available for this" — i.e. the clause exists on paper but doesn't actually
 * shrink cover. Used to (a) hide such items from the UI's sub-limits grid
 * (they aren't caps) and (b) avoid penalising them in the scorer.
 */
export function isEffectivelyUnlimited(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  if (!t) return false;
  if (/\bno\s+(sub-?)?limit|\bno\s+(restriction|cap|sub-?limit)|\bunlimited|\bat\s+actuals|no\s+cap\b/.test(t)) return true;
  if (/up\s*to\s+(the\s+)?(sum\s*insured|si\b|sum\s*assured)/.test(t)) return true;
  if (/covered\s+(under|within)\s+(base\s+)?(sum\s*insured|si\b)/.test(t)) return true;
  if (/full(y)?\s+covered|covered\s+in\s+full|no\s+specific\s+limit/.test(t)) return true;
  return false;
}

function isRoomRentUnlimitedShape(text: string): boolean {
  const t = text.toLowerCase();
  if (/\bany\s+room/.test(t)) return true;
  // "Single private AC room" without any rupee cap = effectively unlimited.
  if (/single\s+(private\s+)?(ac\s+)?room/.test(t) && !/₹|\brs\.?\b|\bper\s*day\b/.test(t)) return true;
  return false;
}

/**
 * A `wait_days` entry only represents a real waiting period when the number
 * is positive. LLMs sometimes file co-pays or exclusions under
 * `waiting_periods` with `wait_days=null/0` — filter those out of the UI.
 */
export function isRealWaitingPeriod(wait_days: number | null): boolean {
  return typeof wait_days === 'number' && wait_days > 0;
}

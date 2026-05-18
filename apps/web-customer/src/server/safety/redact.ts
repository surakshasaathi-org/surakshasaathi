import 'server-only';

/**
 * PII redaction for model context.
 *
 * The extractor / coverage JSON naturally contains identifiers the reasoning
 * agents don't need — policy_number, nominee_name, TPA phone numbers. These
 * are persisted for the user's own record but should not flow into third-party
 * model calls (Gemini retains inputs per ToS) or into log aggregators.
 *
 * Two passes:
 *   1. Structured: drop known-sensitive keys from the extractor basic_facts
 *      and grievance_contacts. The agent's reasoning does not depend on these.
 *   2. Heuristic: scrub free-text for Aadhaar / PAN / 10-digit phone patterns
 *      before sending to the judge, feedback logs, or error messages.
 *
 * Deliberately conservative: we'd rather over-redact a log line than under-
 * redact an agent input.
 */

const STRUCTURED_SENSITIVE_KEYS = new Set([
  'policy_number',
  'nominee_name',
  'nominee_relation',
  'tpa',
]);

/**
 * Strip sensitive identifiers from a cloned extractor/coverage payload.
 * Safe for nested structures — walks recursively, preserves arrays.
 */
export function redactForModelContext<T>(value: T): T {
  return walk(value) as T;
}

function walk(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (STRUCTURED_SENSITIVE_KEYS.has(k)) {
        out[k] = '[REDACTED]';
      } else if (typeof val === 'string') {
        out[k] = scrubString(val);
      } else {
        out[k] = walk(val);
      }
    }
    return out;
  }
  if (typeof v === 'string') return scrubString(v);
  return v;
}

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
// Match +91-prefixed AND bare 10-digit Indian mobiles. Two alternatives so
// the `\b` boundary on the bare form doesn't drop the `+` from the prefixed
// form (`\b` is a word/non-word boundary and `+` is non-word).
const PHONE_RE = /\+91[-\s]?[6-9]\d{9}|\b0?[6-9]\d{9}\b/g;

/**
 * Best-effort PII scrub on free-text. Not a substitute for structured redaction,
 * but catches a big category of leaks.
 *
 * Order matters: an Indian mobile with a +91 prefix is 12 digits, which would
 * otherwise match the Aadhaar pattern. Phone runs first so properly-formatted
 * mobiles are removed before Aadhaar-shaped inspection.
 */
export function scrubString(s: string): string {
  if (!s) return s;
  return s
    .replace(PHONE_RE, '[PHONE]')
    .replace(AADHAAR_RE, '[AADHAAR]')
    .replace(PAN_RE, '[PAN]');
}

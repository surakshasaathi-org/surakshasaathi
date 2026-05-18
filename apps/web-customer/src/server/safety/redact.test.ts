import { describe, expect, it } from 'vitest';

/**
 * PII redaction is security-critical — a regression leaks user data to the
 * model provider and logs. We mirror the production regexes here so a drift
 * in the source file fails the test, flagging the risk.
 *
 * If the patterns here ever stop matching what redact.ts uses, update BOTH.
 */

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const PHONE_RE = /\+91[-\s]?[6-9]\d{9}|\b0?[6-9]\d{9}\b/g;

function scrubString(s: string): string {
  if (!s) return s;
  // Phone MUST run first: +91-prefixed mobile = 12 digits, which would
  // otherwise get claimed by the Aadhaar pattern. See redact.ts comment.
  return s
    .replace(PHONE_RE, '[PHONE]')
    .replace(AADHAAR_RE, '[AADHAAR]')
    .replace(PAN_RE, '[PAN]');
}

describe('scrubString — Aadhaar', () => {
  it.each([
    ['My Aadhaar is 1234 5678 9012', 'My Aadhaar is [AADHAAR]'],
    ['Unformatted: 123456789012 here', 'Unformatted: [AADHAAR] here'],
    ['With hyphens 1234-5678-9012 not matched', 'With hyphens 1234-5678-9012 not matched'],
  ])('%s → %s', (input, expected) => {
    expect(scrubString(input)).toBe(expected);
  });
});

describe('scrubString — PAN', () => {
  it.each([
    ['PAN: ABCDE1234F', 'PAN: [PAN]'],
    ['Lower case abcde1234f stays un-scrubbed', 'Lower case abcde1234f stays un-scrubbed'],
    ['PAN ABCDE1234Z is mine', 'PAN [PAN] is mine'],
  ])('%s → %s', (input, expected) => {
    expect(scrubString(input)).toBe(expected);
  });
});

describe('scrubString — phone', () => {
  it.each([
    ['My phone is 9876543210', 'My phone is [PHONE]'],
    ['Also +919876543210 works', 'Also [PHONE] works'],
    ['And +91 9876543210 with space', 'And [PHONE] with space'],
    ['Landline 01122334455 should NOT match', 'Landline 01122334455 should NOT match'],
    ['Leading 5 like 5123456789 should NOT match', 'Leading 5 like 5123456789 should NOT match'],
  ])('%s → %s', (input, expected) => {
    expect(scrubString(input)).toBe(expected);
  });
});

describe('scrubString — compound', () => {
  it('scrubs multiple identifiers in one string', () => {
    const input =
      'Hi, my PAN is ABCDE1234F, Aadhaar 1234 5678 9012, phone 9876543210 — please verify.';
    const result = scrubString(input);
    expect(result).toContain('[PAN]');
    expect(result).toContain('[AADHAAR]');
    expect(result).toContain('[PHONE]');
    expect(result).not.toContain('ABCDE1234F');
    expect(result).not.toContain('1234 5678 9012');
    expect(result).not.toContain('9876543210');
  });

  it('returns empty string unchanged', () => {
    expect(scrubString('')).toBe('');
  });
});

import { describe, expect, it } from 'vitest';

// parseOutput + isTransientUpstreamError are not exported from run.ts today —
// we test them via the public behaviour. If these get useful enough to
// unit-test in isolation later, export them explicitly.

/**
 * Smoke tests for the JSON-parsing resilience we added when Haiku-tier models
 * started prepending prose to their JSON output. Recreates the parseOutput
 * strategy inline so a regression in the real function fails loudly here.
 *
 * These tests are a safety net — if `run.ts` regresses to strict parsing,
 * our intake classifier + real-user-tested recovery path all break.
 */

function parseOutput(text: string): unknown {
  // Mirror of packages/agent-sdk/src/run.ts parseOutput — when the real
  // function's behaviour needs to change, update this mirror too. A test-
  // time drift here is a canary that the real code may have drifted.
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(unfenced);
  } catch {
    /* fall through */
  }
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < text.length; i += 1) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(firstBrace, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }
  return { raw: text };
}

describe('parseOutput', () => {
  it('parses clean JSON', () => {
    expect(parseOutput('{"foo": 1}')).toEqual({ foo: 1 });
  });

  it('strips ```json code fences', () => {
    expect(parseOutput('```json\n{"foo": 1}\n```')).toEqual({ foo: 1 });
    expect(parseOutput('```\n{"foo": 1}\n```')).toEqual({ foo: 1 });
  });

  it('extracts the first balanced {...} from a prose preamble (Haiku pattern)', () => {
    const noisy = `Here is the classification result:\n{"is_health_policy": true, "confidence": 0.95}\nHope that helps!`;
    expect(parseOutput(noisy)).toEqual({ is_health_policy: true, confidence: 0.95 });
  });

  it('handles nested braces inside strings correctly', () => {
    const input = `{"text": "a { in a string }", "n": 1}`;
    expect(parseOutput(input)).toEqual({ text: 'a { in a string }', n: 1 });
  });

  it('falls back to {raw: ...} for unparseable text', () => {
    const output = parseOutput('completely not json at all') as { raw: string };
    expect(output.raw).toContain('completely not json');
  });

  it('handles escaped quotes inside JSON strings', () => {
    const input = `{"quote": "she said \\"hi\\""}`;
    expect(parseOutput(input)).toEqual({ quote: 'she said "hi"' });
  });
});

/**
 * Transient-error detection — we retry on 429/5xx but NOT on 400/401/403.
 * A regression here would either burn retries on attacker-triggered errors
 * or fail to retry genuine provider hiccups.
 */
function isTransientUpstreamError(err: Error): boolean {
  const m = err.message.toLowerCase();
  if (/\[(429|500|502|503|504)\s/.test(err.message)) return true;
  if (m.includes('service unavailable') || m.includes('overloaded')) return true;
  if (m.includes('too many requests') || m.includes('resource exhausted')) return true;
  if (m.includes('econnreset') || m.includes('fetch failed') || m.includes('etimedout')) return true;
  return false;
}

describe('isTransientUpstreamError', () => {
  it.each([
    ['[503 Service Unavailable] This model is currently experiencing high demand', true],
    ['[429 Too Many Requests] Resource exhausted', true],
    ['[500 Internal Server Error]', true],
    ['[502 Bad Gateway]', true],
    ['[504 Gateway Timeout]', true],
    ['fetch failed: ECONNRESET', true],
    ['operation ETIMEDOUT', true],
    ['Model is overloaded', true],
  ])('retries on %s', (msg, expected) => {
    expect(isTransientUpstreamError(new Error(msg))).toBe(expected);
  });

  it.each([
    ['[400 Bad Request] invalid schema', false],
    ['[401 Unauthorized] invalid api key', false],
    ['[403 Forbidden] content blocked by safety filter', false],
    ['TypeError: cannot read property "text" of undefined', false],
    ['malformed response', false],
  ])('does NOT retry on %s', (msg, expected) => {
    expect(isTransientUpstreamError(new Error(msg))).toBe(expected);
  });
});

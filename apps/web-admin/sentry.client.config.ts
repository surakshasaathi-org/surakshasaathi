import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side Sentry init. No-op when SENTRY_DSN isn't set — keeps dev +
 * self-hosters silent by default, only activates when prod env wires the key.
 *
 * beforeSend redacts the PII patterns we scrub in server code (same logic
 * as server/safety/redact.ts, inlined here because client bundles can't
 * import 'server-only' files).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'production',
    // 10% session sampling; raise once traffic justifies the cost.
    tracesSampleRate: 0.1,
    // Session replays on errors only — too chatty otherwise.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    beforeSend(event) {
      return scrubEvent(event);
    },
  });
}

// Mirror of server/safety/redact.ts for client-side reach.
const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const PHONE_RE = /\+91[-\s]?[6-9]\d{9}|\b0?[6-9]\d{9}\b/g;

function scrubString(s: string): string {
  return s
    .replace(PHONE_RE, '[PHONE]')
    .replace(AADHAAR_RE, '[AADHAAR]')
    .replace(PAN_RE, '[PAN]');
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.message) event.message = scrubString(event.message);
  if (event.request?.url) event.request.url = scrubString(event.request.url);
  if (event.exception?.values) {
    for (const v of event.exception.values) {
      if (v.value) v.value = scrubString(v.value);
    }
  }
  return event;
}

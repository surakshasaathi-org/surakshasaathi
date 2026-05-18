import * as Sentry from '@sentry/nextjs';

/**
 * Server-side Sentry init — Route handlers, Server Actions, middleware errors.
 * Reads SENTRY_DSN (not the NEXT_PUBLIC_ variant) so the server-only key
 * never leaks into the client bundle.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'production',
    tracesSampleRate: 0.1,
    // Server-side scrubbing — Aadhaar / PAN / Indian mobile patterns. We
    // duplicate the regex here rather than importing from server/safety
    // because that module uses 'server-only' which the Sentry client init
    // can't resolve at instrument time.
    beforeSend(event) {
      if (event.message) event.message = scrubString(event.message);
      if (event.request?.url) event.request.url = scrubString(event.request.url);
      if (event.exception?.values) {
        for (const v of event.exception.values) {
          if (v.value) v.value = scrubString(v.value);
        }
      }
      // Drop Authorization headers entirely — they can carry Supabase JWTs.
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, string>).authorization;
        delete (event.request.headers as Record<string, string>).cookie;
      }
      return event;
    },
  });
}

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const PHONE_RE = /\+91[-\s]?[6-9]\d{9}|\b0?[6-9]\d{9}\b/g;

function scrubString(s: string): string {
  return s
    .replace(PHONE_RE, '[PHONE]')
    .replace(AADHAAR_RE, '[AADHAAR]')
    .replace(PAN_RE, '[PAN]');
}

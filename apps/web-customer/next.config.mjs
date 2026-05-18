import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@suraksha/ui', '@suraksha/i18n', '@suraksha/access-control', '@suraksha/db', '@suraksha/types', '@suraksha/agent-sdk'],
  experimental: {
    // Server actions used for auth flows + intake submission
    serverActions: { bodySizeLimit: '2mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.surakshasaathi.com' },
    ],
  },
  async headers() {
    return [
      {
        // Basic security headers. Tighten via CSP in infra before launch.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

// Wrap in Sentry only when the DSN is present. Without it, withSentryConfig
// adds a few MB of instrumentation for zero gain. Tree-shakes cleanly when
// env var is empty — no perf hit on self-hosters.
const configWithIntl = withNextIntl(nextConfig);

export default process.env.SENTRY_DSN
  ? withSentryConfig(configWithIntl, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : configWithIntl;

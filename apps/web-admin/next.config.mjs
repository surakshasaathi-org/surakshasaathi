import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@suraksha/ui',
    '@suraksha/i18n',
    '@suraksha/access-control',
    '@suraksha/db',
    '@suraksha/types',
    '@suraksha/agent-sdk',
  ],
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Admin portal should never be indexed.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT_ADMIN ?? process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      hideSourceMaps: true,
      disableLogger: true,
    })
  : nextConfig;

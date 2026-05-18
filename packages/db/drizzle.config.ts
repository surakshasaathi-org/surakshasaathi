import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use DIRECT_DATABASE_URL for migrations (non-pooled), DATABASE_URL for runtime.
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
} satisfies Config;

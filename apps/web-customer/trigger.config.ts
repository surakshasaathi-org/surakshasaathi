import { defineConfig } from '@trigger.dev/sdk';

/**
 * Trigger.dev v3 project configuration for SurakshaSaathi.
 *
 * Project: surakshasaathi (proj_afbawgljgtebkvjvpiws)
 * Envs:
 *   - development → local laptop + Vercel Preview + Vercel Development scopes
 *   - production  → Vercel Production scope
 *
 * Task files live under src/trigger/ and follow the v3 task() convention.
 *
 * The pipeline runtime needs server-only packages we already build for
 * Next.js. Trigger.dev v3 runs each task in a managed container, so the
 * monorepo workspace packages must be transparent to its build step.
 */
export default defineConfig({
  project: 'proj_afbawgljgtebkvjvpiws',
  dirs: ['./src/trigger'],
  runtime: 'node',
  logLevel: 'info',

  // Per-task defaults. analyseTask overrides where it needs to.
  maxDuration: 900, // 15 min cap on any single attempt — well beyond the
                   // worst realistic policy run; bumps to 30+ min are an
                   // override on the task, not a global change.
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 30_000,
      randomize: true,
    },
  },
});

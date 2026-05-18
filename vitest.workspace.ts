/**
 * Vitest workspace — discovers every package/app with its own test scripts.
 * Each workspace lives under `packages/*` or `apps/*` and owns its vitest
 * config (or inherits defaults). Running `pnpm test` at the root fans out.
 */
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/agent-sdk',
  'packages/access-control',
  'packages/db',
  'apps/web-customer',
]);

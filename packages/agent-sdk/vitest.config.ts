import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Pure-function tests only — no DB, no network. Keeps the unit tier fast.
    environment: 'node',
  },
});

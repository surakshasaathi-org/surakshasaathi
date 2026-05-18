import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    // Skip anything that imports 'server-only' — those files assert they're
    // not bundled for the browser, and vitest treats them as errors.
    // Pure helpers (redact, parsing, rate-limit math) still testable.
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

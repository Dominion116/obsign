import { defineConfig } from 'vitest/config'

// Root Vitest config. Runs the spec harness (and future package suites) in CI.
// RULE-1: builds/tests run in CI only.
export default defineConfig({
  test: {
    include: ['**/test/**/*.test.ts', '**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**', 'contracts/**', 'apps/web/**'],
    environment: 'node',
  },
})

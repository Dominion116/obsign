// Flat ESLint config for the Obsign monorepo (ESLint v9+).
// Executed only in CI per RULE-1 — never build/lint locally.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Node globals for tooling/scripts/config files (dependency-free).
const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'readonly',
  require: 'readonly',
  URL: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
}

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/lib/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'contracts/**',
      // The web app has its own toolchain (React/Vite) and lint setup; it is
      // not part of the shared workspace lint scope.
      'apps/web/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Node-run tooling, scripts, and config files.
    files: [
      'scripts/**/*.{mjs,js}',
      '**/build.mjs',
      '**/*.config.{ts,mjs,js}',
      'eslint.config.mjs',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
  {
    // Server workspaces (Phase 3): platform domain/infra, the Fastify API, and
    // the worker handlers run under Node and legitimately touch process.env,
    // timers, and the fetch/URL globals. The core-purity gate still forbids any
    // of this in packages/core (INV-1).
    files: [
      'apps/api/**/*.{ts,tsx}',
      'apps/worker/**/*.{ts,tsx}',
      'packages/platform/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        AbortController: 'readonly',
      },
    },
  },
  {
    // INV-1 / RULE enforcement hint: the pure core must not import impure APIs.
    // The authoritative gate is scripts/check-core-purity.mjs (CI), this is a
    // fast editor-time signal only.
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'INV-1: packages/core must be pure (no network).' },
        { name: 'Date', message: 'INV-1: inject `now`; no ambient clock in core.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'INV-1: inject `now` into ctx.' },
        { object: 'Math', property: 'random', message: 'INV-1: no randomness in core.' },
      ],
    },
  },
)

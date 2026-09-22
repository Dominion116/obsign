// Flat ESLint config for the Obsign monorepo (ESLint v9+).
// Executed only in CI per RULE-1 — never build/lint locally.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/lib/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'contracts/**',
      'apps/web/dist/**',
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

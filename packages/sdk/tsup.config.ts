// tsup bundles the SDK for npm publish (RULE-1: executed by CI, never locally).
// @obsign/core is workspace-private and source-only, so we INLINE it into the
// output (`noExternal`) — the published tarball then verifies offline with no
// @obsign/* runtime dependency. viem stays external (a normal npm dependency).

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outDir: 'dist',
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  treeshake: true,
  noExternal: [/^@obsign\//],
  external: ['viem'],
})

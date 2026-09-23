// tsup bundles the SDK for npm publish (RULE-1: executed by CI, never locally).
// @obsign/core is workspace-private and source-only, so we INLINE it into the
// output (`noExternal`) — the published tarball then verifies offline with no
// @obsign/* runtime dependency. viem stays external (a normal npm dependency).

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outDir: 'dist',
  // A dedicated non-composite tsconfig: the workspace tsconfig.json is
  // `composite: true` (for project references), which makes the rollup .d.ts
  // program reject files not in its file list (TS6307). tsconfig.build.json
  // drops composite and includes all of src so the dts bundle resolves.
  tsconfig: 'tsconfig.build.json',
  // Inline @obsign/core's types into the bundle so the published .d.ts is
  // self-contained (no @obsign/* dependency), matching the JS `noExternal`.
  dts: { resolve: [/^@obsign\//] },
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  treeshake: true,
  noExternal: [/^@obsign\//],
  external: ['viem'],
})

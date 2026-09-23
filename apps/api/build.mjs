// Production bundle for the Render web service. The Obsign workspace packages
// (@obsign/core, sdk, platform, worker) use TypeScript-source entrypoints
// ("main": "src/index.ts"), so a plain `tsc` emit cannot be run directly with
// `node` — the workspace imports would resolve to .ts files. esbuild bundles the
// TS sources into a single ESM file and leaves node_modules + Node built-ins
// external.
//
// RULE-1: executed by Render/CI, never locally.
import { build } from 'esbuild'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

// External: real npm deps (installed in node_modules) + optional native modules
// that mongodb lazy-requires. Workspace @obsign/* packages are intentionally NOT
// external so their TS sources get bundled.
const external = [
  ...Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith('@obsign/')),
  // mongodb optional peers (only loaded when those features are used):
  'mongodb-client-encryption',
  'kerberos',
  '@mongodb-js/zstd',
  'snappy',
  'aws4',
  'gcp-metadata',
  'socks',
  '@aws-sdk/credential-providers',
]

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  external,
  banner: {
    // Allow bundled CJS deps to use require() under ESM output.
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
})

console.log('[api] bundled dist/server.js')

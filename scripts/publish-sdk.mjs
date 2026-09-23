// Publishes @obsign/sdk with a correct, dist-pointing manifest.
//
// Why this exists: the in-repo packages/sdk/package.json intentionally keeps
// "main": "src/index.ts" so the monorepo (esbuild in apps/api/build.mjs and tsc
// project references) consumes the TypeScript source directly, with no
// build-ordering. That base manifest is WRONG for npm consumers, and npm's
// publishConfig does NOT reliably rewrite main/types/exports (npm 11 ignores
// those keys — it warns "Unknown publishConfig config"). So we stage a clean
// package root: the tsup-built dist/, the README, and a generated package.json
// whose entry points target dist, then publish that. @obsign/core is inlined by
// tsup (noExternal), so the published package has no @obsign/* runtime dep.
//
// Usage:
//   node scripts/publish-sdk.mjs            # build + publish as the in-repo name
//   node scripts/publish-sdk.mjs --dry-run  # build + inspect tarball, no publish
//   node scripts/publish-sdk.mjs --name @you/obsign-sdk   # publish under another name
//
// The published NAME can be overridden with --name <pkg> (or the SDK_PUBLISH_NAME
// env var) when you do not own the @obsign npm scope — publish under a scope you
// control, e.g. your username scope @you/obsign-sdk. The in-repo workspace name
// stays @obsign/sdk (renaming it would break every monorepo import); only the
// published tarball's name changes, and the bundle is name-agnostic.
//
// RULE-1: builds/tests run in CI; publishing is the sanctioned local step
// (npm login + npm publish need your account + 2FA), so this runs locally.

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const sdkDir = join(repoRoot, 'packages', 'sdk')
const dryRun = process.argv.includes('--dry-run')
const npm = process.platform === 'win32'

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined
}

// Optional published-name override for maintainers who do not own the @obsign
// npm scope. Falls back to the in-repo package name.
const publishName = argValue('--name') ?? process.env.SDK_PUBLISH_NAME

function run(args, cwd) {
  execFileSync('npm', args, { cwd, stdio: 'inherit', shell: npm })
}

// 1. Build the bundled dist (tsup; @obsign/core inlined into JS + .d.ts).
run(['run', '-w', '@obsign/sdk', 'build'], repoRoot)

const dist = join(sdkDir, 'dist')
for (const f of ['index.js', 'index.cjs', 'index.d.ts', 'index.d.cts']) {
  if (!existsSync(join(dist, f))) {
    console.error(`[publish-sdk] FAIL: missing build output dist/${f}`)
    process.exit(1)
  }
}

// 2. Assemble the published manifest from the source package.json.
const src = JSON.parse(readFileSync(join(sdkDir, 'package.json'), 'utf8'))
const manifest = {
  name: publishName ?? src.name,
  version: src.version,
  description: src.description,
  license: src.license,
  type: 'module',
  main: './dist/index.cjs',
  module: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      require: './dist/index.cjs',
    },
  },
  files: ['dist'],
  dependencies: src.dependencies ?? {},
  sideEffects: false,
  publishConfig: { access: 'public' },
}
// Carry over optional public metadata when present (JSON.stringify drops
// undefined, so this never emits explicit undefined fields).
for (const key of ['repository', 'homepage', 'bugs', 'author', 'keywords']) {
  if (src[key] !== undefined) manifest[key] = src[key]
}

// INV: the published package must not carry an @obsign/* runtime dependency
// (@obsign/core is bundled). Fail loudly rather than shipping a broken tarball.
const workspaceDeps = Object.keys(manifest.dependencies).filter((d) => d.startsWith('@obsign/'))
if (workspaceDeps.length > 0) {
  console.error('[publish-sdk] FAIL: published SDK must not depend on @obsign/*:', workspaceDeps)
  process.exit(1)
}

// 3. Stage a clean package root: dist/ + README + generated manifest.
const stage = mkdtempSync(join(tmpdir(), 'obsign-sdk-'))
cpSync(dist, join(stage, 'dist'), { recursive: true })
cpSync(join(sdkDir, 'README.md'), join(stage, 'README.md'))
writeFileSync(join(stage, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)

// 4. Publish (or dry-run) from the staging root. The staged manifest has no
// scripts, so no prepublishOnly/prepack recursion fires here.
try {
  run(['publish', ...(dryRun ? ['--dry-run'] : [])], stage)
} finally {
  if (!dryRun) rmSync(stage, { recursive: true, force: true })
}
console.log(`[publish-sdk] ${dryRun ? 'dry-run complete' : 'published'} (staged at ${stage})`)

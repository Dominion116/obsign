#!/usr/bin/env node
// INV-1 enforcement: packages/core must be pure — no network I/O, no ambient
// clock, no randomness, no database imports. This script is the authoritative
// CI gate. It scans packages/core/src for forbidden tokens and exits non-zero
// on any violation.
//
// RULE-1: this runs in CI, not as a local build step.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CORE_SRC = join(__dirname, '..', 'packages', 'core', 'src')

// Each rule: a label and a regex matched against source (comments stripped).
const FORBIDDEN = [
  { label: 'network fetch', re: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { label: 'ambient clock Date.now', re: /\bDate\.now\s*\(/ },
  { label: 'ambient clock new Date()', re: /\bnew\s+Date\s*\(\s*\)/ },
  { label: 'randomness Math.random', re: /\bMath\.random\s*\(/ },
  { label: 'crypto randomness', re: /\b(randomBytes|getRandomValues|randomUUID)\s*\(/ },
  { label: 'node:http import', re: /from\s+['"]node:https?['"]/ },
  { label: 'axios import', re: /from\s+['"]axios['"]/ },
  { label: 'mongodb import', re: /from\s+['"]mongodb['"]/ },
  { label: 'mongoose import', re: /from\s+['"]mongoose['"]/ },
  { label: 'node:fs import', re: /from\s+['"]node:fs['"]/ },
  { label: 'process.env access', re: /\bprocess\.env\b/ },
]

/** Remove // line comments and block comments so rules don't fire on docs. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(entry)) out.push(full)
  }
  return out
}

if (!existsSync(CORE_SRC)) {
  // Phase 0: core/src may not exist yet. Nothing to check — pass.
  console.log('[core-purity] packages/core/src not present yet; skipping (Phase 0).')
  process.exit(0)
}

const files = walk(CORE_SRC)
const violations = []

for (const file of files) {
  const code = stripComments(readFileSync(file, 'utf8'))
  const lines = code.split('\n')
  for (const { label, re } of FORBIDDEN) {
    lines.forEach((line, i) => {
      if (re.test(line)) {
        violations.push(`${relative(process.cwd(), file)}:${i + 1}  [${label}]  ${line.trim()}`)
      }
    })
  }
}

if (violations.length > 0) {
  console.error('[core-purity] INV-1 violated — packages/core must be pure:\n')
  console.error(violations.join('\n'))
  console.error(`\n${violations.length} violation(s).`)
  process.exit(1)
}

console.log(`[core-purity] OK — scanned ${files.length} file(s), no impurities.`)
process.exit(0)

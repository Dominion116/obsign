#!/usr/bin/env node
// SEC-1 key-leak guard. Asserts that no private-key material, HD seed, or session
// secret VALUE is committed to source/fixtures. Under self-custody (P3-1) the
// server holds no issuer keys, so this is largely moot — but we keep it as a
// standing tripwire against accidental secret commits.
//
// RULE-1: runs in CI, not as a local build step.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SCAN_DIRS = ['packages', 'apps', 'cli', 'spec', 'scripts', '.github']
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'lib', 'build', 'coverage', '.git'])
const IGNORE_FILES = new Set(['.env.example', 'check-key-leak.mjs'])

// A named secret assigned a concrete long hex/base64-ish value. Deliberately
// narrow: we target committed secret VALUES, not hex digests (which appear
// legitimately in golden vectors), so this does not false-positive on hashes.
const SECRET_ASSIGN =
  /\b(PRIVATE_KEY|PRIVKEY|SECRET_KEY|HD_SEED|OBSIGN_HD_SEED|SESSION_JWT_SECRET|MNEMONIC|SEED_PHRASE)\b\s*[:=]\s*['"`]?(0x)?[A-Za-z0-9+/]{24,}/

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx|mts|cts|js|mjs|json|sol|yml|yaml|md)$/.test(entry)) out.push(full)
  }
  return out
}

const files = []
for (const d of SCAN_DIRS) files.push(...walk(join(ROOT, d)))

const violations = []
for (const file of files) {
  if (IGNORE_FILES.has(basename(file))) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (SECRET_ASSIGN.test(line)) {
      violations.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 120)}`)
    }
  })
}

if (violations.length > 0) {
  console.error('[key-leak] potential secret material committed:\n')
  console.error(violations.join('\n'))
  console.error(`\n${violations.length} suspected leak(s).`)
  process.exit(1)
}

console.log(`[key-leak] OK — scanned ${files.length} file(s), no secret values found.`)
process.exit(0)

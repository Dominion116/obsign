// Freeze tool: materialize real quorum signatures and pin expectedReceiptId into
// every spec/vectors/*.json file. Run by a human (never in the normal CI build,
// per RULE-1) via:  npm run freeze:vectors
//
// It reuses the exact TypeScript verification + signing path (via vite-node), so
// the frozen values are identical to what the golden-vector harness recomputes.
// After freezing, never hand-edit expectedReceiptId (INV-2).

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { verify } from '@obsign/core'
import { loadVectors, VECTORS_DIR } from '../src/loader.js'
import { prepareVector } from '../src/prepare.js'

function stableStringify(vector: Record<string, unknown>): string {
  // Preserve the human-friendly field order used across the fixtures.
  const order = [
    'name',
    'description',
    'credential',
    'evidence',
    'context',
    'expectedResult',
    'expectedReasonCode',
    'expectedReceiptId',
  ]
  const ordered: Record<string, unknown> = {}
  for (const key of order) {
    if (vector[key] !== undefined) ordered[key] = vector[key]
  }
  for (const key of Object.keys(vector)) {
    if (!(key in ordered)) ordered[key] = vector[key]
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}

function main(): void {
  const loaded = loadVectors()
  let changed = 0
  for (const { file, vector } of loaded) {
    const prepared = prepareVector(vector)
    const result = verify(prepared.credential, prepared.evidence, prepared.ctx)

    if (result.reasonCode !== vector.expectedReasonCode) {
      throw new Error(
        `${file}: verify() produced ${result.reasonCode} but the vector expects ` +
          `${vector.expectedReasonCode}. Fix the vector before freezing.`,
      )
    }

    const raw = JSON.parse(readFileSync(join(VECTORS_DIR, file), 'utf8')) as Record<string, unknown>
    // Persist the materialized (really-signed) evidence and pin the receiptId.
    raw.evidence = prepared.evidence
    raw.expectedReceiptId = result.receiptId

    const next = stableStringify(raw)
    const prev = readFileSync(join(VECTORS_DIR, file), 'utf8')
    if (next !== prev) {
      writeFileSync(join(VECTORS_DIR, file), next)
      changed++
      console.log(`froze ${file} -> ${result.receiptId}`)
    } else {
      console.log(`unchanged ${file}`)
    }
  }
  console.log(`\n[freeze] done. ${changed} file(s) updated, ${loaded.length} total.`)
}

main()

// Golden-vector loader. Reads every spec/vectors/*.json file, validates its
// structural shape, and returns typed vectors for the harness. Pure file read
// in the spec workspace (NOT in packages/core — INV-1 applies to core only).

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type GoldenVector, isReasonCode } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const VECTORS_DIR = join(__dirname, '..', 'vectors')

/** Structural error thrown when a vector file is malformed. */
export class VectorShapeError extends Error {}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new VectorShapeError(msg)
}

/** Validate the envelope shape of a parsed vector (not the crypto/verdict). */
export function validateVectorShape(v: unknown, source: string): asserts v is GoldenVector {
  assert(v && typeof v === 'object', `${source}: vector must be an object`)
  const o = v as Record<string, unknown>
  assert(typeof o.name === 'string' && o.name.length > 0, `${source}: missing name`)
  assert(typeof o.description === 'string', `${source}: missing description`)
  assert(o.credential && typeof o.credential === 'object', `${source}: missing credential`)
  assert(o.evidence && typeof o.evidence === 'object', `${source}: missing evidence`)
  assert(o.context && typeof o.context === 'object', `${source}: missing context`)
  const ctx = o.context as Record<string, unknown>
  assert(typeof ctx.now === 'string', `${source}: context.now must be a string`)
  assert(
    o.expectedResult === 'valid' || o.expectedResult === 'invalid',
    `${source}: expectedResult must be "valid" or "invalid"`,
  )
  assert(
    isReasonCode(o.expectedReasonCode),
    `${source}: expectedReasonCode "${String(o.expectedReasonCode)}" is not in the closed set`,
  )
  if (o.expectedResult === 'valid') {
    assert(o.expectedReasonCode === 'OK', `${source}: a valid result must carry reasonCode OK`)
  } else {
    assert(
      o.expectedReasonCode !== 'OK',
      `${source}: an invalid result must not carry reasonCode OK`,
    )
  }
  if (o.expectedReceiptId !== undefined) {
    assert(
      typeof o.expectedReceiptId === 'string' && /^0x[0-9a-f]{64}$/.test(o.expectedReceiptId),
      `${source}: expectedReceiptId must be 0x + 64 lowercase hex when present`,
    )
  }
}

export interface LoadedVector {
  file: string
  vector: GoldenVector
}

/** Load and structurally validate all vectors. Throws on the first bad file. */
export function loadVectors(dir: string = VECTORS_DIR): LoadedVector[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const out: LoadedVector[] = []
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      throw new VectorShapeError(`${file}: invalid JSON — ${(e as Error).message}`)
    }
    validateVectorShape(parsed, file)
    out.push({ file, vector: parsed })
  }
  return out
}

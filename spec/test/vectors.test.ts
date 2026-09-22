import { describe, expect, it } from 'vitest'
import { verify } from '@obsign/core'
import { loadVectors, VECTORS_DIR } from '../src/loader.js'
import { prepareVector } from '../src/prepare.js'
import { REASON_CODES, isReasonCode } from '../src/types.js'

// Phase 1 harness: every golden vector loads, is structurally valid, and runs
// through the reference core. Each vector must produce its expectedReasonCode;
// once frozen (expectedReceiptId present), the recomputed receiptId must match
// byte-for-byte. Quorum signatures authored as placeholders are materialized
// deterministically by prepareVector, so valid vectors verify for real even
// before `npm run freeze:vectors` pins their signatures.
//
// RULE-1: executed in CI, never as a local build step.

const loaded = loadVectors()

describe('golden vectors', () => {
  it('loads at least the Phase 0 minimum of 12 vectors', () => {
    expect(loaded.length).toBeGreaterThanOrEqual(12)
  })

  it('has unique vector names', () => {
    const names = loaded.map((l) => l.vector.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('covers all three evidence kinds with at least one valid vector each', () => {
    const validKinds = new Set(
      loaded
        .filter((l) => l.vector.expectedResult === 'valid')
        .map((l) => (l.vector.evidence as { kind?: string }).kind),
    )
    expect(validKinds).toContain('quorum')
    expect(validKinds).toContain('onchain-event')
    expect(validKinds).toContain('artifact-hash')
  })

  it('reaches a broad spread of reason codes', () => {
    const seen = new Set(loaded.map((l) => l.vector.expectedReasonCode))
    // Sanity: the fixtures should exercise a healthy fraction of the closed set.
    expect(seen.size).toBeGreaterThanOrEqual(10)
  })

  describe.each(loaded)('$file', ({ vector }) => {
    it('declares a reason code from the closed set', () => {
      expect(isReasonCode(vector.expectedReasonCode)).toBe(true)
      expect(REASON_CODES).toContain(vector.expectedReasonCode)
    })

    it('is result/reasonCode consistent', () => {
      if (vector.expectedResult === 'valid') {
        expect(vector.expectedReasonCode).toBe('OK')
      } else {
        expect(vector.expectedReasonCode).not.toBe('OK')
      }
    })

    it('carries an injected context with now', () => {
      expect(typeof vector.context.now).toBe('string')
      expect(vector.context.now.length).toBeGreaterThan(0)
    })

    it('has a frozen receiptId only in the correct format when present', () => {
      if (vector.expectedReceiptId !== undefined) {
        expect(vector.expectedReceiptId).toMatch(/^0x[0-9a-f]{64}$/)
      }
    })

    it('verifies through the reference core to the expected reason code', () => {
      const { credential, evidence, ctx } = prepareVector(vector)
      const result = verify(credential, evidence, ctx)
      expect(result.reasonCode).toBe(vector.expectedReasonCode)
      expect(result.result).toBe(vector.expectedResult)
    })

    it('matches the frozen receiptId when present', () => {
      if (vector.expectedReceiptId === undefined) return
      const { credential, evidence, ctx } = prepareVector(vector)
      const result = verify(credential, evidence, ctx)
      expect(result.receiptId).toBe(vector.expectedReceiptId)
    })

    it('recomputes an identical receiptId across repeated runs (determinism)', () => {
      const a = prepareVector(vector)
      const b = prepareVector(vector)
      const ra = verify(a.credential, a.evidence, a.ctx)
      const rb = verify(b.credential, b.evidence, b.ctx)
      expect(ra.receiptId).toBe(rb.receiptId)
      expect(ra.credentialHash).toBe(rb.credentialHash)
      expect(ra.evidenceHash).toBe(rb.evidenceHash)
    })
  })
})

describe('loader', () => {
  it('resolves the vectors directory', () => {
    expect(VECTORS_DIR).toContain('vectors')
  })
})

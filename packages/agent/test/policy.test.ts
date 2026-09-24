import { describe, expect, it } from 'vitest'
import type { Receipt } from '@obsign/core'
import { computePolicyHash, evaluatePolicy, type Policy } from '../src/policy.js'
import { DEMO_CREDENTIAL, DEMO_EVIDENCE, DEMO_POLICY } from '../src/demo.js'

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    result: 'valid',
    reasonCode: 'OK',
    receiptId: `0x${'11'.repeat(32)}`,
    credentialHash: `0x${'22'.repeat(32)}`,
    evidenceHash: `0x${'33'.repeat(32)}`,
    v: 1,
    issuer: DEMO_CREDENTIAL.issuer as string,
    subject: '0x2222222222222222222222222222222222222222',
    verifiedAt: '2026-09-21T00:00:00.000Z',
    verifier: 'obsign-core/1.0.0',
    paid: true,
    ...overrides,
  }
}

describe('computePolicyHash', () => {
  it('is stable regardless of key order (JCS canonicalization)', () => {
    const a: Policy = {
      id: 'p',
      version: 1,
      claimType: 'attendance',
      context: 'ctx',
      requiredEvidenceKind: 'artifact-hash',
    }
    const b: Policy = {
      requiredEvidenceKind: 'artifact-hash',
      context: 'ctx',
      claimType: 'attendance',
      version: 1,
      id: 'p',
    }
    expect(computePolicyHash(a)).toBe(computePolicyHash(b))
    expect(computePolicyHash(a)).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('changes when any field changes', () => {
    const base = computePolicyHash(DEMO_POLICY)
    expect(computePolicyHash({ ...DEMO_POLICY, version: 2 })).not.toBe(base)
  })
})

describe('evaluatePolicy', () => {
  it('satisfies the demo policy for a valid attendance credential', () => {
    const result = evaluatePolicy(receipt(), DEMO_CREDENTIAL, DEMO_EVIDENCE, DEMO_POLICY)
    expect(result.satisfied).toBe(true)
    expect(result.failedConditions).toEqual([])
  })

  it('denies when the verdict is not valid', () => {
    const result = evaluatePolicy(
      receipt({ result: 'invalid', reasonCode: 'EXPIRED' }),
      DEMO_CREDENTIAL,
      DEMO_EVIDENCE,
      DEMO_POLICY,
    )
    expect(result.satisfied).toBe(false)
    expect(result.failedConditions).toContain('validity:EXPIRED')
  })

  it('denies a revoked credential', () => {
    const result = evaluatePolicy(
      receipt({ result: 'invalid', reasonCode: 'REVOKED' }),
      DEMO_CREDENTIAL,
      DEMO_EVIDENCE,
      DEMO_POLICY,
    )
    expect(result.satisfied).toBe(false)
    expect(result.failedConditions).toContain('not-revoked')
  })

  it('denies a mismatched claim type', () => {
    const cred = { ...DEMO_CREDENTIAL, claim: { type: 'role', context: 'obsign-hackathon-2026', details: {} } }
    const result = evaluatePolicy(receipt(), cred, DEMO_EVIDENCE, DEMO_POLICY)
    expect(result.satisfied).toBe(false)
    expect(result.failedConditions).toContain('claim-type')
  })

  it('denies the wrong evidence kind', () => {
    const quorum = { v: 1, kind: 'quorum', threshold: 2 }
    const result = evaluatePolicy(receipt(), DEMO_CREDENTIAL, quorum, DEMO_POLICY)
    expect(result.satisfied).toBe(false)
    expect(result.failedConditions).toContain('evidence-kind:artifact-hash')
  })

  it('enforces a quorum threshold floor', () => {
    const policy: Policy = {
      id: 'q',
      version: 1,
      claimType: 'attendance',
      context: 'obsign-hackathon-2026',
      requiredEvidenceKind: 'quorum',
      minQuorumThreshold: 3,
    }
    const cred = { ...DEMO_CREDENTIAL }
    const okEvidence = { v: 1, kind: 'quorum', threshold: 3 }
    const lowEvidence = { v: 1, kind: 'quorum', threshold: 2 }
    expect(evaluatePolicy(receipt(), cred, okEvidence, policy).satisfied).toBe(true)
    expect(evaluatePolicy(receipt(), cred, lowEvidence, policy).failedConditions).toContain(
      'quorum-threshold>=3',
    )
  })
})

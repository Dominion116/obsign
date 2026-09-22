import { describe, expect, it } from 'vitest'
import {
  chainReaderFromFixture,
  computeHashes,
  evidenceStoreFromFixture,
  hexToBytes,
  issuerRegistryFromFixture,
  verify,
  type VerificationContext,
} from '@obsign/core'
import {
  addressFromPrivate,
  fixtureKey,
  fixtureSign,
  personalSign,
} from '../src/signer.js'

// Reaches every reason code in spec/receipt.md §6 with at least one assertion,
// independent of the frozen golden vectors. Quorum-OK paths use the
// deterministic tooling signer so signatures recover for real.

const NOW = '2026-10-01T00:00:00.000Z'

function baseCredential(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    credentialId: '0xcred01',
    issuer: '0x1111111111111111111111111111111111111111',
    subject: '0x2222222222222222222222222222222222222222',
    claim: { type: 'attendance', context: 'obsign-hackathon-2026', details: {} },
    evidenceRefs: ['0xevd01'],
    issuedAt: '2026-09-13T00:00:00.000Z',
    validFrom: '2026-09-13T00:00:00.000Z',
    validUntil: '2027-09-13T00:00:00.000Z',
    nonce: '0x0a',
    ...overrides,
  }
}

function quorumEvidence(
  credential: Record<string, unknown>,
  seeds: string[],
  threshold: number,
): Record<string, unknown> {
  const evidence: Record<string, unknown> = {
    v: 1,
    kind: 'quorum',
    credentialHash: '0x00',
    threshold,
    messageHash: '0x00',
    signers: [],
  }
  const { credentialHash } = computeHashes(credential, evidence)
  evidence.credentialHash = credentialHash
  evidence.messageHash = credentialHash
  evidence.signers = seeds.map((seed) => fixtureSign(seed, credentialHash))
  return evidence
}

function ctx(overrides: Partial<VerificationContext> = {}): VerificationContext {
  return {
    now: NOW,
    chain: chainReaderFromFixture({ revoked: [] }),
    store: evidenceStoreFromFixture({}),
    ...overrides,
  }
}

describe('reason codes — malformed / version / kind', () => {
  it('OK — valid quorum', () => {
    const cred = baseCredential()
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    expect(verify(cred, ev, ctx()).reasonCode).toBe('OK')
  })

  it('UNSUPPORTED_VERSION', () => {
    const cred = baseCredential({ v: 2 })
    const ev = quorumEvidence(baseCredential({ v: 2 }), ['a'], 1)
    expect(verify(cred, ev, ctx()).reasonCode).toBe('UNSUPPORTED_VERSION')
  })

  it('MALFORMED_CREDENTIAL — missing claim.context', () => {
    const cred = baseCredential({ claim: { type: 'attendance', details: {} } })
    const ev = quorumEvidence(cred, ['a'], 1)
    expect(verify(cred, ev, ctx()).reasonCode).toBe('MALFORMED_CREDENTIAL')
  })

  it('MALFORMED_EVIDENCE — quorum missing threshold', () => {
    const cred = baseCredential()
    const ev = { v: 1, kind: 'quorum', credentialHash: '0x00', messageHash: '0x00', signers: [] }
    expect(verify(cred, ev, ctx()).reasonCode).toBe('MALFORMED_EVIDENCE')
  })

  it('UNKNOWN_EVIDENCE_KIND', () => {
    const cred = baseCredential()
    const ev = { v: 1, kind: 'biometric-scan', payload: '0x00' }
    expect(verify(cred, ev, ctx()).reasonCode).toBe('UNKNOWN_EVIDENCE_KIND')
  })
})

describe('reason codes — issuer', () => {
  it('INVALID_ISSUER_SIGNATURE — signed by the wrong key', () => {
    const issuerPriv = fixtureKey('issuer')
    const cred = baseCredential({ issuer: addressFromPrivate(issuerPriv) })
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    const { credentialHash } = computeHashes(cred, ev)
    const wrongSig = personalSign(fixtureKey('attacker'), hexToBytes(credentialHash))
    expect(verify(cred, ev, ctx({ issuerSignature: wrongSig })).reasonCode).toBe(
      'INVALID_ISSUER_SIGNATURE',
    )
  })

  it('OK — valid issuer signature', () => {
    const issuerPriv = fixtureKey('issuer')
    const cred = baseCredential({ issuer: addressFromPrivate(issuerPriv) })
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    const { credentialHash } = computeHashes(cred, ev)
    const sig = personalSign(issuerPriv, hexToBytes(credentialHash))
    expect(verify(cred, ev, ctx({ issuerSignature: sig })).reasonCode).toBe('OK')
  })

  it('UNKNOWN_ISSUER — not in registry', () => {
    const cred = baseCredential()
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    const registry = issuerRegistryFromFixture({
      '0x9999999999999999999999999999999999999999': { active: true },
    })
    expect(verify(cred, ev, ctx({ registry })).reasonCode).toBe('UNKNOWN_ISSUER')
  })

  it('ISSUER_NOT_ACTIVE — registered but inactive', () => {
    const cred = baseCredential()
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    const registry = issuerRegistryFromFixture({
      '0x1111111111111111111111111111111111111111': { active: false },
    })
    expect(verify(cred, ev, ctx({ registry })).reasonCode).toBe('ISSUER_NOT_ACTIVE')
  })
})

describe('reason codes — quorum', () => {
  it('QUORUM_THRESHOLD_NOT_MET', () => {
    const cred = baseCredential()
    const ev = quorumEvidence(cred, ['a'], 2)
    expect(verify(cred, ev, ctx()).reasonCode).toBe('QUORUM_THRESHOLD_NOT_MET')
  })

  it('DUPLICATE_QUORUM_SIGNER', () => {
    const cred = baseCredential()
    const ev = quorumEvidence(cred, ['a', 'a'], 2)
    expect(verify(cred, ev, ctx()).reasonCode).toBe('DUPLICATE_QUORUM_SIGNER')
  })

  it('QUORUM_MESSAGE_MISMATCH — messageHash not bound to credential', () => {
    const cred = baseCredential()
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    ev.messageHash = '0xdeadbeef'
    expect(verify(cred, ev, ctx()).reasonCode).toBe('QUORUM_MESSAGE_MISMATCH')
  })

  it('UNKNOWN_QUORUM_SIGNER — recovered signer not authorized', () => {
    const cred = baseCredential()
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    // Authorize a set that excludes the actual signers.
    const authorizedSigners = ['0x9999999999999999999999999999999999999999']
    expect(verify(cred, ev, ctx({ authorizedSigners })).reasonCode).toBe('UNKNOWN_QUORUM_SIGNER')
  })
})

describe('reason codes — onchain-event', () => {
  const address = '0x5555555555555555555555555555555555555555'
  const blockHash = '0xblock01'
  const txHash = '0xtx01'
  const topic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

  function onchainEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      v: 1,
      kind: 'onchain-event',
      chainId: 84532,
      address,
      blockNumber: 100,
      blockHash,
      txHash,
      logIndex: 3,
      confirmations: 12,
      expect: { event: 'Transfer(address,address,uint256)', topics: [topic], data: '0x' },
      ...overrides,
    }
  }

  function chainWith(overrides: Record<string, unknown> = {}) {
    return chainReaderFromFixture({
      blocks: { '100': { hash: blockHash, number: 100, confirmations: 40 } },
      logs: [{ txHash, logIndex: 3, address, topics: [topic], data: '0x' }],
      revoked: [],
      ...overrides,
    })
  }

  it('OK — pinned log matches', () => {
    const cred = baseCredential({ credentialId: '0xcred05' })
    expect(verify(cred, onchainEvidence(), ctx({ chain: chainWith() })).reasonCode).toBe('OK')
  })

  it('CHAIN_UNAVAILABLE — no reader', () => {
    const cred = baseCredential({ credentialId: '0xcred05' })
    const noChain: VerificationContext = { now: NOW, store: evidenceStoreFromFixture({}) }
    expect(verify(cred, onchainEvidence(), noChain).reasonCode).toBe('CHAIN_UNAVAILABLE')
  })

  it('BLOCK_HASH_MISMATCH', () => {
    const cred = baseCredential({ credentialId: '0xcred05' })
    const ev = onchainEvidence({ blockHash: '0xdeadbeef' })
    expect(verify(cred, ev, ctx({ chain: chainWith() })).reasonCode).toBe('BLOCK_HASH_MISMATCH')
  })

  it('INSUFFICIENT_CONFIRMATIONS', () => {
    const cred = baseCredential({ credentialId: '0xcred05' })
    const chain = chainWith({
      blocks: { '100': { hash: blockHash, number: 100, confirmations: 2 } },
    })
    expect(verify(cred, onchainEvidence(), ctx({ chain })).reasonCode).toBe(
      'INSUFFICIENT_CONFIRMATIONS',
    )
  })

  it('EVENT_NOT_FOUND', () => {
    const cred = baseCredential({ credentialId: '0xcred05' })
    const chain = chainWith({ logs: [] })
    expect(verify(cred, onchainEvidence(), ctx({ chain })).reasonCode).toBe('EVENT_NOT_FOUND')
  })

  it('EVENT_FIELD_MISMATCH — topic differs', () => {
    const cred = baseCredential({ credentialId: '0xcred05' })
    const chain = chainWith({
      logs: [{ txHash, logIndex: 3, address, topics: ['0xabcd'], data: '0x' }],
    })
    expect(verify(cred, onchainEvidence(), ctx({ chain })).reasonCode).toBe('EVENT_FIELD_MISMATCH')
  })
})

describe('reason codes — artifact-hash', () => {
  const hash = '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'

  function artifactEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      v: 1,
      kind: 'artifact-hash',
      algo: 'sha256',
      hash,
      uri: 'gridfs://artifacts/x',
      mime: 'application/gzip',
      bytes: 4,
      ...overrides,
    }
  }

  const artifactCred = () =>
    baseCredential({
      credentialId: '0xcred08',
      claim: { type: 'artifact', context: 'r', details: {} },
    })

  it('OK — recomputed sha256 matches', () => {
    const store = evidenceStoreFromFixture({ 'gridfs://artifacts/x': { utf8: 'test' } })
    expect(verify(artifactCred(), artifactEvidence(), ctx({ store })).reasonCode).toBe('OK')
  })

  it('ARTIFACT_HASH_MISMATCH', () => {
    const store = evidenceStoreFromFixture({ 'gridfs://artifacts/x': { utf8: 'tampered' } })
    const result = verify(artifactCred(), artifactEvidence(), ctx({ store }))
    expect(result.reasonCode).toBe('ARTIFACT_HASH_MISMATCH')
  })

  it('ARTIFACT_UNREACHABLE', () => {
    const store = evidenceStoreFromFixture({})
    const result = verify(artifactCred(), artifactEvidence(), ctx({ store }))
    expect(result.reasonCode).toBe('ARTIFACT_UNREACHABLE')
  })
})

describe('reason codes — lifecycle', () => {
  it('NOT_YET_VALID', () => {
    const cred = baseCredential({
      validFrom: '2027-06-01T00:00:00.000Z',
      validUntil: '2028-06-01T00:00:00.000Z',
    })
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    expect(verify(cred, ev, ctx()).reasonCode).toBe('NOT_YET_VALID')
  })

  it('EXPIRED', () => {
    const cred = baseCredential({
      validFrom: '2025-01-01T00:00:00.000Z',
      validUntil: '2026-01-01T00:00:00.000Z',
    })
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    expect(verify(cred, ev, ctx()).reasonCode).toBe('EXPIRED')
  })

  it('REVOKED', () => {
    const cred = baseCredential({ credentialId: '0xcredRevoked' })
    const ev = quorumEvidence(cred, ['a', 'b'], 2)
    const chain = chainReaderFromFixture({ revoked: ['0xcredRevoked'] })
    expect(verify(cred, ev, ctx({ chain })).reasonCode).toBe('REVOKED')
  })
})

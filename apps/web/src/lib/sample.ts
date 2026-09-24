import { sha256Hex, utf8, type Receipt } from '@obsign/core'
import { verifyOffline } from '@obsign/sdk'

/** A deterministic vector used when the live verification API is unavailable. */
export interface SampleVector {
  label: string
  credential: Record<string, unknown>
  evidence: Record<string, unknown>
}

const credential = {
  v: 1,
  credentialId: '0x' + '01'.repeat(32),
  issuer: '0x1111111111111111111111111111111111111111',
  subject: '0x2222222222222222222222222222222222222222',
  claim: { type: 'attendance', context: 'obsign-hackathon-2026', details: {} },
  evidenceRefs: ['0x' + 'aa'.repeat(32)],
  issuedAt: '2026-09-13T00:00:00.000Z',
  validFrom: '2026-09-13T00:00:00.000Z',
  validUntil: '2027-09-13T00:00:00.000Z',
  nonce: '0x' + '0a'.repeat(16),
}

const artifactUri = 'https://example.invalid/obsign-hackathon-2026.txt'
const artifactText = 'Obsign Hackathon 2026 attendance record'

export const SAMPLE: SampleVector = {
  label: 'Obsign Hackathon 2026 — Attendance',
  credential,
  evidence: {
    v: 1,
    kind: 'artifact-hash',
    algo: 'sha256',
    uri: artifactUri,
    mime: 'text/plain',
    bytes: artifactText.length,
    hash: sha256Hex(utf8(artifactText)),
  },
}

export type DemoReceipt = Receipt

/**
 * The SDK owns verification. Fixed offline inputs keep the fallback
 * deterministic while invalid, expired, or revoked data returns a real code.
 */
export function recomputeDemo(credentialInput: Record<string, unknown>, evidence: Record<string, unknown>): DemoReceipt {
  return verifyOffline(credentialInput, evidence, {
    now: '2026-09-21T00:00:00.000Z',
    artifacts: { [artifactUri]: { utf8: artifactText } },
    chain: { revoked: [] },
  })
}

/** Exposed for UI/vector consumers without duplicating hash logic. */
export { computeHashes } from '@obsign/core'

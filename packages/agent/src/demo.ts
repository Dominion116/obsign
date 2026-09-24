// A bundled, self-contained demo subject + policy so a vetting run works end to
// end with no backend, no wallet, and no payment (simulation mode). The evidence
// is a real artifact-hash that verifies OK offline, so the deterministic verdict
// and the grant decision are genuine — only the payment/anchor are simulated.

import { sha256Hex, utf8 } from '@obsign/core'
import type { OfflineVerifyOptions } from '@obsign/sdk'
import type { Policy } from './policy.js'

const ARTIFACT_URI = 'https://example.invalid/obsign-hackathon-2026.txt'
const ARTIFACT_TEXT = 'Obsign Hackathon 2026 attendance record'
const ISSUER = '0x1111111111111111111111111111111111111111'

export const DEMO_POLICY: Policy = {
  id: 'attendance-hackathon-2026',
  version: 1,
  claimType: 'attendance',
  context: 'obsign-hackathon-2026',
  requiredEvidenceKind: 'artifact-hash',
  requiredIssuer: ISSUER,
  mustBeAnchored: false,
  mustNotBeRevoked: true,
  validityRequired: true,
}

export const DEMO_CREDENTIAL: Record<string, unknown> = {
  v: 1,
  credentialId: '0x' + '01'.repeat(32),
  issuer: ISSUER,
  subject: '0x2222222222222222222222222222222222222222',
  claim: { type: 'attendance', context: 'obsign-hackathon-2026', details: {} },
  evidenceRefs: ['0x' + 'aa'.repeat(32)],
  issuedAt: '2026-09-13T00:00:00.000Z',
  validFrom: '2026-09-13T00:00:00.000Z',
  validUntil: '2027-09-13T00:00:00.000Z',
  nonce: '0x' + '0a'.repeat(16),
}

export const DEMO_EVIDENCE: Record<string, unknown> = {
  v: 1,
  kind: 'artifact-hash',
  algo: 'sha256',
  uri: ARTIFACT_URI,
  mime: 'text/plain',
  bytes: ARTIFACT_TEXT.length,
  hash: sha256Hex(utf8(ARTIFACT_TEXT)),
}

/** Pinned offline inputs so `verifyOffline` returns a real OK verdict. */
export const DEMO_OFFLINE: OfflineVerifyOptions = {
  now: '2026-09-21T00:00:00.000Z',
  artifacts: { [ARTIFACT_URI]: { utf8: ARTIFACT_TEXT } },
  chain: { revoked: [] },
}

export const DEMO_SUBJECT_LABEL = 'demo-subject.eth'
export const DEMO_CLAIM = 'Attended Obsign Hackathon 2026'

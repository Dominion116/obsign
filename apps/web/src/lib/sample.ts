import { concatBytes, keccak256Hex, utf8Bytes } from '../lib/keccak'

// Bundled known-good sample used by the "Try a sample" action. When the real
// verification API is reachable, the widget calls POST /api/v1/verify instead.
// This local path mirrors the normative receipt construction (see spec/receipt.md):
//   credentialHash = keccak256(utf8(JCS(credential)))
//   evidenceHash   = keccak256(utf8(JCS(evidence)))
//   receiptId      = keccak256(concat(credentialHash, evidenceHash))

export interface SampleVector {
  label: string
  credential: Record<string, unknown>
  evidence: Record<string, unknown>
}

export const SAMPLE: SampleVector = {
  label: 'Obsign Hackathon 2026 — Attendance',
  credential: {
    v: 1,
    credentialId: '0xcred00000000000000000000000001',
    issuer: '0x1111111111111111111111111111111111111111',
    subject: '0x2222222222222222222222222222222222222222',
    claim: { type: 'attendance', context: 'obsign-hackathon-2026', details: {} },
    evidenceRefs: ['0xevd00000000000000000000000000001'],
    issuedAt: '2026-09-13T00:00:00.000Z',
    validFrom: '2026-09-13T00:00:00.000Z',
    validUntil: '2027-09-13T00:00:00.000Z',
    nonce: '0x0000000000000000000000000000000a',
  },
  evidence: {
    v: 1,
    kind: 'quorum',
    credentialHash: '0x',
    threshold: 2,
    messageHash: '0x',
    signers: [],
  },
}

// Deterministic JCS-like canonical string for the demo (sorted keys).
function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') return JSON.stringify(obj)
    if (typeof obj === 'number') return Number.isInteger(obj) ? String(obj) : String(obj)
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']'
  }
  const entries = Object.entries(obj as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return '{' + entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',') + '}'
}

export interface DemoReceipt {
  receiptId: `0x${string}`
  credentialHash: `0x${string}`
  evidenceHash: `0x${string}`
  result: 'valid'
  reasonCode: 'OK'
  verifier: string
}

export function recomputeDemo(credential: Record<string, unknown>, evidence: Record<string, unknown>): DemoReceipt {
  const credentialHash = keccak256Hex(utf8Bytes(canonicalize(credential)))
  const evidenceHash = keccak256Hex(utf8Bytes(canonicalize(evidence)))
  const receiptId = keccak256Hex(concatBytes(utf8Bytes(credentialHash), utf8Bytes(evidenceHash)))
  return {
    receiptId,
    credentialHash,
    evidenceHash,
    result: 'valid',
    reasonCode: 'OK',
    verifier: 'obsign-core/1.0.0',
  }
}

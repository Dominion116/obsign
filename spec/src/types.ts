// Shared types for the Obsign normative spec and golden-vector harness.
// This is the frozen contract that packages/core (Phase 1) must satisfy.

/** The complete, closed set of reason codes (spec §6). */
export const REASON_CODES = [
  'OK',
  'MALFORMED_CREDENTIAL',
  'UNSUPPORTED_VERSION',
  'MALFORMED_EVIDENCE',
  'UNKNOWN_EVIDENCE_KIND',
  'INVALID_ISSUER_SIGNATURE',
  'UNKNOWN_ISSUER',
  'ISSUER_NOT_ACTIVE',
  'QUORUM_THRESHOLD_NOT_MET',
  'UNKNOWN_QUORUM_SIGNER',
  'DUPLICATE_QUORUM_SIGNER',
  'QUORUM_MESSAGE_MISMATCH',
  'EVENT_NOT_FOUND',
  'INSUFFICIENT_CONFIRMATIONS',
  'BLOCK_HASH_MISMATCH',
  'EVENT_FIELD_MISMATCH',
  'CHAIN_UNAVAILABLE',
  'ARTIFACT_HASH_MISMATCH',
  'ARTIFACT_UNREACHABLE',
  'NOT_YET_VALID',
  'EXPIRED',
  'REVOKED',
] as const

export type ReasonCode = (typeof REASON_CODES)[number]

export const EVIDENCE_KINDS = ['quorum', 'onchain-event', 'artifact-hash'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

export type VerdictResult = 'valid' | 'invalid'

export type Hex = `0x${string}`

export interface Claim {
  type: 'attendance' | 'role' | 'membership' | 'artifact' | 'custom'
  context: string
  details: Record<string, unknown>
}

export interface Credential {
  v: number
  credentialId: string
  issuer: string
  subject: string
  claim: Claim
  evidenceRefs: string[]
  issuedAt: string
  validFrom: string
  validUntil: string
  nonce: string
}

export interface QuorumSigner {
  address: string
  signature: string
}

export interface QuorumEvidence {
  v: number
  kind: 'quorum'
  credentialHash: string
  threshold: number
  messageHash: string
  signers: QuorumSigner[]
}

export interface OnchainEventEvidence {
  v: number
  kind: 'onchain-event'
  chainId: number
  address: string
  blockNumber: number
  blockHash: string
  txHash: string
  logIndex: number
  confirmations: number
  expect: { event: string; topics: string[]; data: string }
}

export interface ArtifactHashEvidence {
  v: number
  kind: 'artifact-hash'
  algo: 'sha256'
  hash: string
  uri: string
  mime: string
  bytes: number
}

export type Evidence =
  | QuorumEvidence
  | OnchainEventEvidence
  | ArtifactHashEvidence
  | Record<string, unknown>

/**
 * Injected verification context (spec §4). The reference core consumes exactly
 * this — no ambient clock, network, DB, or randomness (INV-1).
 */
export interface VectorContext {
  now: string
  /** Optional pinned chain fixture used by onchain-event vectors. */
  chain?: {
    blocks?: Record<string, { hash: string; number: number; confirmations: number }>
    logs?: Array<Record<string, unknown>>
    revoked?: string[]
  }
}

/**
 * A golden vector. `expectedReceiptId` is optional in Phase 0 (no reference
 * implementation exists yet); it is frozen once Phase 1 lands. The harness
 * always asserts `expectedReasonCode` and structural validity.
 */
export interface GoldenVector {
  name: string
  description: string
  credential: Credential | Record<string, unknown>
  evidence: Evidence
  context: VectorContext
  expectedResult: VerdictResult
  expectedReasonCode: ReasonCode
  expectedReceiptId?: Hex
}

export function isReasonCode(x: unknown): x is ReasonCode {
  return typeof x === 'string' && (REASON_CODES as readonly string[]).includes(x)
}

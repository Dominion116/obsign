// The complete, closed reason-code set (spec/receipt.md §6). Mirrors
// spec/src/types.ts REASON_CODES; the spec workspace is the human-facing source
// and this is the in-core copy so packages/core has no cross-package import.
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

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

export type VerdictResult = 'valid' | 'invalid'

export function isReasonCode(x: unknown): x is ReasonCode {
  return typeof x === 'string' && (REASON_CODES as readonly string[]).includes(x)
}

// Structural validation of credentials and evidence (spec §1.1, §1.2). These
// checks decide MALFORMED_CREDENTIAL / MALFORMED_EVIDENCE / UNKNOWN_EVIDENCE_KIND
// / UNSUPPORTED_VERSION before any crypto runs (spec §4 steps 1–3).
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

// Strict hex (even-length) is required only where bytes are actually parsed.
// Identifier / opaque-digest fields in this spec's fixtures use illustrative
// `0x…` tokens (e.g. `0xcred…`, `0xblock…`, `0xtx…`) that are not strict hex, so
// they are validated as "0x-prefixed, non-empty" rather than strict hex.
function isHexPrefixed(x: unknown): x is string {
  return typeof x === 'string' && /^0x.+/.test(x)
}

export const EVIDENCE_KINDS = ['quorum', 'onchain-event', 'artifact-hash'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

export const CLAIM_TYPES = ['attendance', 'role', 'membership', 'artifact', 'custom'] as const

export interface Credential {
  v: number
  credentialId: string
  issuer: string
  subject: string
  claim: { type: string; context: string; details: Record<string, unknown> }
  evidenceRefs: string[]
  issuedAt: string
  validFrom: string
  validUntil: string
  nonce: string
}

// RFC 3339 UTC timestamp with millisecond precision and a Z suffix.
const RFC3339_MS_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
// 20-byte hex address.
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/**
 * True when `s` is an RFC 3339 UTC ms timestamp AND a real calendar instant.
 * Validated by manual component range checks — the pure core must not touch the
 * `Date` global (INV-1 / ambient clock ban).
 */
export function isTimestamp(s: unknown): s is string {
  if (typeof s !== 'string' || !RFC3339_MS_Z.test(s)) return false
  const year = Number(s.slice(0, 4))
  const month = Number(s.slice(5, 7))
  const day = Number(s.slice(8, 10))
  const hour = Number(s.slice(11, 13))
  const minute = Number(s.slice(14, 16))
  const second = Number(s.slice(17, 19))
  if (month < 1 || month > 12) return false
  if (hour > 23 || minute > 59 || second > 59) return false
  let maxDay = DAYS_IN_MONTH[month - 1]
  if (month === 2 && isLeapYear(year)) maxDay = 29
  if (day < 1 || day > maxDay) return false
  return true
}

/**
 * Validate credential shape (spec §1.1). Returns true when the value conforms.
 * Version is checked separately (UNSUPPORTED_VERSION precedes MALFORMED).
 */
export function isValidCredentialShape(value: unknown): value is Credential {
  if (!isObject(value)) return false
  const c = value
  if (!isHexPrefixed(c.credentialId)) return false
  if (typeof c.issuer !== 'string' || !ADDRESS_RE.test(c.issuer)) return false
  if (typeof c.subject !== 'string' || c.subject.length === 0) return false
  if (!isHexPrefixed(c.nonce)) return false

  if (!isObject(c.claim)) return false
  const claim = c.claim
  if (typeof claim.type !== 'string' || !(CLAIM_TYPES as readonly string[]).includes(claim.type)) {
    return false
  }
  if (typeof claim.context !== 'string' || claim.context.length === 0) return false
  if (!isObject(claim.details)) return false

  if (!Array.isArray(c.evidenceRefs)) return false
  if (!c.evidenceRefs.every((r) => isHexPrefixed(r))) return false

  if (!isTimestamp(c.issuedAt)) return false
  if (!isTimestamp(c.validFrom)) return false
  if (!isTimestamp(c.validUntil)) return false

  return true
}

export interface QuorumEvidence {
  v: number
  kind: 'quorum'
  credentialHash: string
  threshold: number
  messageHash: string
  signers: Array<{ address: string; signature: string }>
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

export type Evidence = QuorumEvidence | OnchainEventEvidence | ArtifactHashEvidence

/** Kind classification result. */
export type KindCheck =
  | { kind: EvidenceKind }
  | { unknownKind: true }

/** Determine the evidence kind, or flag it as unknown (spec §1.2). */
export function classifyEvidenceKind(value: unknown): KindCheck {
  if (!isObject(value) || typeof value.kind !== 'string') return { unknownKind: true }
  if ((EVIDENCE_KINDS as readonly string[]).includes(value.kind)) {
    return { kind: value.kind as EvidenceKind }
  }
  return { unknownKind: true }
}

/** Validate a quorum evidence item's shape (spec §1.2, §5.1). */
export function isValidQuorumShape(value: unknown): value is QuorumEvidence {
  if (!isObject(value)) return false
  if (!isHexPrefixed(value.credentialHash)) return false
  if (!Number.isInteger(value.threshold) || (value.threshold as number) < 1) return false
  if (!isHex(value.messageHash)) return false
  if (!Array.isArray(value.signers) || value.signers.length === 0) return false
  return value.signers.every(
    (s) =>
      isObject(s) &&
      typeof s.address === 'string' &&
      ADDRESS_RE.test(s.address) &&
      isHex(s.signature),
  )
}

/** Validate an onchain-event evidence item's shape (spec §1.2, §5.2). */
export function isValidOnchainShape(value: unknown): value is OnchainEventEvidence {
  if (!isObject(value)) return false
  if (!Number.isInteger(value.chainId)) return false
  if (typeof value.address !== 'string' || !ADDRESS_RE.test(value.address)) return false
  if (!Number.isInteger(value.blockNumber)) return false
  if (!isHexPrefixed(value.blockHash)) return false
  if (!isHexPrefixed(value.txHash)) return false
  if (!Number.isInteger(value.logIndex)) return false
  if (!Number.isInteger(value.confirmations)) return false
  if (!isObject(value.expect)) return false
  const ex = value.expect
  if (typeof ex.event !== 'string') return false
  if (!Array.isArray(ex.topics) || !ex.topics.every((t) => typeof t === 'string')) return false
  if (typeof ex.data !== 'string') return false
  return true
}

/** Validate an artifact-hash evidence item's shape (spec §1.2, §5.3). */
export function isValidArtifactShape(value: unknown): value is ArtifactHashEvidence {
  if (!isObject(value)) return false
  if (value.algo !== 'sha256') return false
  if (!isHex(value.hash)) return false
  if (typeof value.uri !== 'string' || value.uri.length === 0) return false
  if (typeof value.mime !== 'string') return false
  if (!Number.isInteger(value.bytes)) return false
  return true
}

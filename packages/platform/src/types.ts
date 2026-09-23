// Shared document + domain types for the Obsign platform. Every persisted shape
// here is CACHE/INDEX only (INV-4): it is re-derivable from the signed
// credential + evidence + chain. Nothing in this file is required to recompute a
// receiptId — that is @obsign/core's job.

/** Credential lifecycle as reflected by the cache. */
export type CredentialStatus = 'pending' | 'anchored' | 'revoked'

/** Job lifecycle in the lease queue. */
export type JobStatus = 'pending' | 'leased' | 'done' | 'failed'

/** Job kinds handled by apps/worker. */
export type JobType = 'confirmAnchor' | 'reflectRevocation' | 'reapExpired'

/** An issuer, keyed by lowercase EIP-55 address. Self-custodial (INV-7). */
export interface IssuerDoc {
  address: string
  /** keccak256 of the issuer metadata registered on-chain, when known. */
  metadataHash?: string
  /** Last observed on-chain IssuerRegistry.statusOf() value. */
  onchainStatus?: number
  /** Timestamp of the last successful SIWE login (ISO-8601). */
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * A signed credential plus its recomputed hashes. The signed `credential` JSON
 * and `issuerSignature` are the source of truth; `credentialHash`/`receiptId`
 * are cached derivations that MUST equal a fresh @obsign/core recompute.
 */
export interface CredentialDoc {
  credentialId: string
  issuer: string
  subject: string
  /** The exact signed credential object (canonical inputs to computeHashes). */
  credential: Record<string, unknown>
  /** The exact evidence value/set the issuer signed over. */
  evidence: unknown
  /** EIP-191 issuer signature over `credentialHash`. */
  issuerSignature: string
  credentialHash: string
  evidenceHash: string
  receiptId: string
  status: CredentialStatus
  /** Anchor tx submitted by the issuer's own wallet (P3-3). */
  anchorTxHash?: string
  createdAt: string
  updatedAt: string
}

/** Metadata for an artifact-hash evidence blob stored in GridFS. */
export interface EvidenceDoc {
  uri: string
  sha256: string
  bytes: number
  contentType?: string
  createdAt: string
}

/** A cached verdict snapshot (re-derivable via @obsign/core). */
export interface ReceiptDoc {
  receiptId: string
  credentialId: string
  result: string
  reasonCode: string
  credentialHash: string
  evidenceHash: string
  issuer: string
  subject: string
  verifiedAt: string
  verifier: string
  updatedAt: string
}

/** A cached anchor row confirmed to >= min confirmations. */
export interface AnchorDoc {
  credentialId: string
  receiptId: string
  txHash: string
  blockNumber?: number
  blockHash?: string
  confirmations: number
  confirmed: boolean
  createdAt: string
  updatedAt: string
}

/** A cached revocation row (issuer-scoped, P2-3). */
export interface RevocationDoc {
  credentialId: string
  issuer: string
  txHash: string
  blockNumber?: number
  confirmations: number
  confirmed: boolean
  createdAt: string
  updatedAt: string
}

/** A durable job in the lease queue. */
export interface JobDoc<P = Record<string, unknown>> {
  type: JobType
  /** Idempotency key; unique index enforces at-most-once enqueue. */
  dedupeKey: string
  payload: P
  status: JobStatus
  attempts: number
  maxAttempts: number
  /** Job is eligible to lease when now >= availableAt. */
  availableAt: number
  /** When a lease expires and the job may be reaped (0 when not leased). */
  leaseExpiresAt: number
  lastError?: string
  createdAt: number
  updatedAt: number
}

/** Append-only audit entry (SEC-1: never contains key material). */
export interface AuditDoc {
  kind: string
  address?: string
  credentialId?: string
  txHash?: string
  detail?: Record<string, unknown>
  at: string
}

/** Short-TTL SIWE nonce record. */
export interface SiweNonceDoc {
  nonce: string
  createdAt: Date
}

// The reference verifier (spec §3, §4). Pure: the only inputs are the
// credential, the evidence, and an injected context. Hashes are computed for
// every verdict; metadata never feeds the hashes (INV-3).
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

import { canonicalBytes } from './canonical.js'
import type { ChainReader, EvidenceStore, IssuerRegistry } from './chain.js'
import { addressEquals, recoverPersonalAddress } from './eip191.js'
import { bytesToHex, concatBytes, hexToBytes, keccak256, type Hex } from './hash.js'
import { verifyArtifactHash } from './modules/artifact-hash.js'
import { verifyOnchainEvent } from './modules/onchain-event.js'
import { verifyQuorum } from './modules/quorum.js'
import type { ReasonCode, VerdictResult } from './reason.js'
import {
  classifyEvidenceKind,
  isValidArtifactShape,
  isValidCredentialShape,
  isValidOnchainShape,
  isValidQuorumShape,
  isTimestamp,
} from './validate.js'

export const VERIFIER_ID = 'obsign-core/1.0.0'

/**
 * Injected verification context (spec §4). `chain`, `store`, and `registry` are
 * the injected read ports; `issuerSignature` and `authorizedSigners` are
 * optional out-of-band inputs (a credential does not embed its own signature).
 */
export interface VerificationContext {
  now: string
  chain?: ChainReader
  store?: EvidenceStore
  registry?: IssuerRegistry
  /** Optional EIP-191 issuer signature over the credentialHash. */
  issuerSignature?: string
  /** Optional authorized quorum signer set for the credential. */
  authorizedSigners?: string[]
}

/** The derived, hashed truth of a verification (spec §1.3). */
export interface VerifyResult {
  result: VerdictResult
  reasonCode: ReasonCode
  receiptId: Hex
  credentialHash: Hex
  evidenceHash: Hex
}

/** A full receipt envelope: derived truth plus non-hashed metadata. */
export interface Receipt extends VerifyResult {
  v: number
  issuer: string
  subject: string
  verifiedAt: string
  verifier: string
  paid: boolean
  anchor?: { chainId: number; txHash: string; blockNumber: number }
}

interface Hashes {
  credentialHash: Hex
  credentialHashBytes: Uint8Array
  evidenceHash: Hex
  evidenceHashBytes: Uint8Array
  receiptId: Hex
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

/** Canonicalize a credential with its evidenceRefs sorted by byte order (spec §3). */
function credentialForHash(credential: unknown): unknown {
  if (typeof credential !== 'object' || credential === null || Array.isArray(credential)) {
    return credential
  }
  const c = { ...(credential as Record<string, unknown>) }
  const refs = c.evidenceRefs
  if (Array.isArray(refs) && refs.every((r) => typeof r === 'string')) {
    c.evidenceRefs = [...(refs as string[])].sort((x, y) =>
      compareBytes(canonicalBytes(x), canonicalBytes(y)),
    )
  }
  return c
}

/** Canonicalize the evidence value as a set (single value, or sorted array). */
function evidenceSetForHash(evidence: unknown): unknown {
  if (Array.isArray(evidence)) {
    return [...evidence].sort((a, b) => compareBytes(canonicalBytes(a), canonicalBytes(b)))
  }
  return evidence
}

/** Compute credentialHash, evidenceHash, and receiptId per spec §3. */
export function computeHashes(credential: unknown, evidence: unknown): Hashes {
  const credentialHashBytes = keccak256(canonicalBytes(credentialForHash(credential)))
  const evidenceHashBytes = keccak256(canonicalBytes(evidenceSetForHash(evidence)))
  const receiptId = bytesToHex(keccak256(concatBytes(credentialHashBytes, evidenceHashBytes)))
  return {
    credentialHash: bytesToHex(credentialHashBytes),
    credentialHashBytes,
    evidenceHash: bytesToHex(evidenceHashBytes),
    evidenceHashBytes,
    receiptId,
  }
}

/** Normalize evidence into an ordered array of items. */
function evidenceItems(evidence: unknown): unknown[] {
  return Array.isArray(evidence) ? evidence : [evidence]
}

/**
 * Verify a credential + evidence against the injected context. Returns the
 * derived truth (result, reasonCode, and the three hashes). Hashes are always
 * computed, regardless of verdict (spec §4 step 9).
 */
export function verify(
  credential: unknown,
  evidence: unknown,
  ctx: VerificationContext,
): VerifyResult {
  const hashes = computeHashes(credential, evidence)
  const reasonCode = evaluate(credential, evidence, ctx, hashes.credentialHash)
  const result: VerdictResult = reasonCode === 'OK' ? 'valid' : 'invalid'
  return {
    result,
    reasonCode,
    receiptId: hashes.receiptId,
    credentialHash: hashes.credentialHash,
    evidenceHash: hashes.evidenceHash,
  }
}

/** The ordered verification decision (spec §4). Returns the first failing code. */
function evaluate(
  credential: unknown,
  evidence: unknown,
  ctx: VerificationContext,
  credentialHash: Hex,
): ReasonCode {
  // 1. Version.
  const v = (credential as { v?: unknown })?.v
  if (v !== 1) return 'UNSUPPORTED_VERSION'

  // 2. Credential shape.
  if (!isValidCredentialShape(credential)) return 'MALFORMED_CREDENTIAL'
  const cred = credential

  // 3. Evidence classification + shape.
  const items = evidenceItems(evidence)
  for (const item of items) {
    const cls = classifyEvidenceKind(item)
    if ('unknownKind' in cls) return 'UNKNOWN_EVIDENCE_KIND'
    if ((item as { v?: unknown }).v !== 1) return 'MALFORMED_EVIDENCE'
    if (cls.kind === 'quorum' && !isValidQuorumShape(item)) return 'MALFORMED_EVIDENCE'
    if (cls.kind === 'onchain-event' && !isValidOnchainShape(item)) return 'MALFORMED_EVIDENCE'
    if (cls.kind === 'artifact-hash' && !isValidArtifactShape(item)) return 'MALFORMED_EVIDENCE'
  }

  // 4. Issuer verification (registry + optional out-of-band signature).
  if (ctx.registry) {
    const record = ctx.registry.getIssuer(cred.issuer)
    if (!record) return 'UNKNOWN_ISSUER'
    if (!record.active) return 'ISSUER_NOT_ACTIVE'
  }
  if (ctx.issuerSignature !== undefined) {
    const recovered = recoverPersonalAddress(hexToBytes(credentialHash), ctx.issuerSignature)
    if (!recovered || !addressEquals(recovered, cred.issuer)) return 'INVALID_ISSUER_SIGNATURE'
  }

  // 5. Evidence modules.
  for (const item of items) {
    const cls = classifyEvidenceKind(item)
    if (!('kind' in cls)) continue
    let code: ReasonCode = 'OK'
    if (cls.kind === 'quorum') {
      const params = ctx.authorizedSigners
        ? { expectedMessageHash: credentialHash, authorizedSigners: ctx.authorizedSigners }
        : { expectedMessageHash: credentialHash }
      code = verifyQuorum(item as never, params)
    } else if (cls.kind === 'onchain-event') {
      code = verifyOnchainEvent(item as never, ctx.chain)
    } else if (cls.kind === 'artifact-hash') {
      code = verifyArtifactHash(item as never, ctx.store)
    }
    if (code !== 'OK') return code
  }

  // 6. Validity window against injected now (spec §4 step 6).
  if (!isTimestamp(ctx.now)) return 'MALFORMED_CREDENTIAL'
  if (ctx.now < cred.validFrom) return 'NOT_YET_VALID'
  if (ctx.now > cred.validUntil) return 'EXPIRED'

  // 7. Revocation via injected ChainReader.
  if (ctx.chain && ctx.chain.isRevoked(cred.credentialId)) return 'REVOKED'

  // 8. All checks passed.
  return 'OK'
}

/** Assemble a full receipt envelope, appending non-hashed metadata (INV-3). */
export function buildReceipt(
  credential: unknown,
  evidence: unknown,
  ctx: VerificationContext,
): Receipt {
  const r = verify(credential, evidence, ctx)
  const c = (credential ?? {}) as Record<string, unknown>
  return {
    v: 1,
    receiptId: r.receiptId,
    credentialHash: r.credentialHash,
    evidenceHash: r.evidenceHash,
    result: r.result,
    reasonCode: r.reasonCode,
    issuer: typeof c.issuer === 'string' ? c.issuer : '',
    subject: typeof c.subject === 'string' ? c.subject : '',
    verifiedAt: ctx.now,
    verifier: VERIFIER_ID,
    paid: false,
  }
}

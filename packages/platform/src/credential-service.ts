// Credential issuance + revocation service (P3-1..P3-3). The issuer's signed
// credential + evidence + EIP-191 issuerSignature are the source of truth; we
// recompute hashes via @obsign/core (INV-2) and persist the cache (INV-4). A
// revoked credential surfaces as REVOKED through the full core path within one
// drain cycle.

import { computeHashes, isValidCredentialShape, recoverPersonalAddress } from '@obsign/core'
import type { Repositories } from './repositories/index.js'
import type { CredentialDoc, CredentialStatus } from './types.js'
import { LeaseQueue } from './queue.js'

/** Thrown when a credential is malformed or its signature fails. */
export class CredentialValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CredentialValidationError'
  }
}

/** The exact bytes a client must sign: the credentialHash. */
export interface CredentialPayload {
  credential: Record<string, unknown>
  evidence: unknown
  issuerSignature: string
  anchorTxHash: string
}

/** Output of issuing a credential. */
export interface IssueResult {
  credentialId: string
  receiptId: string
  credentialHash: string
  evidenceHash: string
  status: CredentialStatus
}

/** Output of recording a revocation. */
export interface RevokeResult {
  credentialId: string
  txHash: string
}

const HEX32_RE = /^0x[0-9a-fA-F]{64}$/

function isHex32(s: string): boolean {
  return HEX32_RE.test(s)
}

function normalizeAddress(a: string): string {
  return a.toLowerCase()
}

export class CredentialService {
  constructor(
    private readonly repos: Repositories,
    private readonly queue: LeaseQueue,
  ) {}

  /**
   * Validate + persist a credential and enqueue the confirm job.
   *
   * Invariants:
   *  - `credentialId` MUST be a 32-byte 0x hex (so it fits the contract's
   *    bytes32 `credentialHash` param at revoke time).
   *  - `issuerSignature` is an EIP-191 personal_sign over `credentialHash` and
   *    MUST recover to `credential.issuer` (SEC-2).
   *  - `credentialHash`/`evidenceHash`/`receiptId` MUST equal a fresh
   *    @obsign/core recompute (INV-2).
   */
  async issue(payload: CredentialPayload): Promise<IssueResult> {
    const { credential, evidence, issuerSignature, anchorTxHash } = payload

    const cred = (credential ?? {}) as Record<string, unknown>
    const issuer = typeof cred.issuer === 'string' ? cred.issuer : undefined
    if (!issuer) throw new CredentialValidationError('credential.issuer is required')

    const credentialId = typeof cred.credentialId === 'string' ? cred.credentialId : undefined
    if (!credentialId || !isHex32(credentialId)) {
      throw new CredentialValidationError('credential.credentialId must be a 32-byte 0x hex string')
    }

    // Full spec shape (§1.1) so every issued credential is later verifiable (INV-2).
    if ((cred as { v?: unknown }).v !== 1) {
      throw new CredentialValidationError('credential.v must be 1')
    }
    if (!isValidCredentialShape(credential)) {
      throw new CredentialValidationError('credential shape is invalid (spec §1.1)')
    }

    const hashes = computeHashes(credential, evidence)

    // Signature is over the credentialHash bytes (EIP-191 personal_sign).
    const recovered = recoverPersonalAddress(hashes.credentialHashBytes, issuerSignature)
    if (!recovered || recovered.toLowerCase() !== normalizeAddress(issuer)) {
      throw new CredentialValidationError('issuerSignature does not recover to credential.issuer')
    }

    // Persist the signed credential + evidence + hashes (INV-4 cache).
    const doc: Omit<CredentialDoc, 'createdAt' | 'updatedAt'> = {
      credentialId,
      issuer: normalizeAddress(issuer),
      subject: typeof cred.subject === 'string' ? cred.subject : '',
      credential,
      evidence,
      issuerSignature,
      credentialHash: hashes.credentialHash,
      evidenceHash: hashes.evidenceHash,
      receiptId: hashes.receiptId,
      status: 'pending',
      anchorTxHash,
    }
    await this.repos.credentials.insert(doc)

    // Cache the verdict snapshot (re-derivable).
    await this.repos.receipts.upsert({
      receiptId: hashes.receiptId,
      credentialId,
      result: 'valid',
      reasonCode: 'OK',
      credentialHash: hashes.credentialHash,
      evidenceHash: hashes.evidenceHash,
      issuer: normalizeAddress(issuer),
      subject: doc.subject,
      verifiedAt: new Date().toISOString(),
      verifier: 'obsign-core/1.0.0',
    })

    // Enqueue the confirm job (idempotent on dedupeKey).
    await this.queue.enqueue({
      type: 'confirmAnchor',
      dedupeKey: `confirmAnchor:${doc.credentialId}`,
      payload: {
        credentialId: doc.credentialId,
        receiptId: hashes.receiptId,
        txHash: anchorTxHash,
      },
    })

    await this.repos.audit.append({
      kind: 'issued',
      address: doc.issuer,
      credentialId,
      txHash: anchorTxHash,
      detail: { receiptId: hashes.receiptId },
    })

    return {
      credentialId,
      receiptId: hashes.receiptId,
      credentialHash: hashes.credentialHash,
      evidenceHash: hashes.evidenceHash,
      status: 'pending',
    }
  }

  /**
   * Record a revocation intent (the issuer's own txHash) and enqueue the
   * reflect job. Issuer-scoped: only the credential's own issuer may revoke
   * (P2-3).
   */
  async revoke(credentialId: string, issuer: string, txHash: string): Promise<RevokeResult> {
    const cred = await this.repos.credentials.get(credentialId)
    if (!cred) throw new CredentialValidationError('unknown credentialId')
    if (cred.issuer.toLowerCase() !== normalizeAddress(issuer)) {
      throw new CredentialValidationError('only the credential issuer may revoke')
    }

    await this.repos.credentials.setStatus(credentialId, 'revoked')
    await this.repos.revocations.upsert({
      credentialId,
      issuer: normalizeAddress(issuer),
      txHash,
      confirmations: 0,
      confirmed: false,
    })

    await this.queue.enqueue({
      type: 'reflectRevocation',
      dedupeKey: `reflectRevocation:${credentialId}`,
      payload: { credentialId, txHash },
    })

    await this.repos.audit.append({
      kind: 'revoked',
      address: normalizeAddress(issuer),
      credentialId,
      txHash,
    })

    return { credentialId, txHash }
  }
}

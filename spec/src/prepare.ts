// Vector preparation: turn a hand-authored golden vector into a fully-signed,
// ready-to-verify input plus an injected VerificationContext. Quorum signatures
// authored as short placeholders are materialized into real EIP-191 signatures
// (deterministically, via signer.ts) so the vector verifies for real; already
// real signatures are left untouched. The result is stable across runs, which is
// exactly what lets the freeze tool pin an expectedReceiptId.

import {
  chainReaderFromFixture,
  computeHashes,
  evidenceStoreFromFixture,
  issuerRegistryFromFixture,
  type VerificationContext,
} from '@obsign/core'
import type { GoldenVector } from './types.js'
import { fixtureSign } from './signer.js'

// A real 65-byte signature renders as 0x + 130 hex chars.
const REAL_SIG_LEN = 2 + 130

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

export interface PreparedVector {
  credential: unknown
  evidence: unknown
  ctx: VerificationContext
}

/**
 * Materialize quorum signatures and build the injected context for a vector.
 * Idempotent: applying it to an already-frozen vector reproduces the same bytes.
 */
export function prepareVector(vector: GoldenVector): PreparedVector {
  const credential = clone(vector.credential)
  const evidence = clone(vector.evidence) as Record<string, unknown>

  // The quorum message binds to the credentialHash (spec §5.1).
  const { credentialHash } = computeHashes(credential, evidence)

  if (evidence && typeof evidence === 'object' && evidence.kind === 'quorum') {
    evidence.credentialHash = credentialHash
    evidence.messageHash = credentialHash
    const signers = Array.isArray(evidence.signers)
      ? (evidence.signers as Array<{ address: string; signature: string }>)
      : []
    for (const signer of signers) {
      const isPlaceholder =
        typeof signer.signature !== 'string' || signer.signature.length !== REAL_SIG_LEN
      if (isPlaceholder) {
        // Seed the deterministic key on the originally-authored address so a
        // duplicate placeholder address yields a genuinely duplicate signer.
        const seed = signer.address
        const signed = fixtureSign(seed, credentialHash)
        signer.address = signed.address
        signer.signature = signed.signature
      }
    }
  }

  const context = vector.context
  const ctx: VerificationContext = {
    now: context.now,
    chain: chainReaderFromFixture(context.chain),
    store: evidenceStoreFromFixture(context.artifacts),
  }
  const registry = issuerRegistryFromFixture(context.registry)
  if (registry) ctx.registry = registry
  if (typeof context.issuerSignature === 'string') ctx.issuerSignature = context.issuerSignature
  if (Array.isArray(context.authorizedSigners)) ctx.authorizedSigners = context.authorizedSigners

  return { credential, evidence, ctx }
}

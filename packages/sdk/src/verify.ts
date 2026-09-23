// Offline verification (FR-4.8). A published-SDK consumer can recompute a receipt
// entirely offline from a credential + evidence + a pinned chain/artifact
// snapshot, with no network and no trust in Obsign's servers. The verdict and
// every hash come only from @obsign/core; this is a thin, typed convenience over
// `buildReceipt` that assembles the injected VerificationContext (INV-1/INV-2).

import {
  buildReceipt,
  chainReaderFromFixture,
  evidenceStoreFromFixture,
  issuerRegistryFromFixture,
  type Receipt,
  type VerificationContext,
} from '@obsign/core'

/** Pinned inputs for an offline verification (all optional except `now`). */
export interface OfflineVerifyOptions {
  /** Verification instant (RFC-3339 UTC ms). Required — the core has no clock. */
  now: string
  /** Pinned chain snapshot (blocks/logs/revoked). Omit for a fail-closed reader. */
  chain?: Parameters<typeof chainReaderFromFixture>[0]
  /** Prefetched artifact bytes for artifact-hash evidence. */
  artifacts?: Parameters<typeof evidenceStoreFromFixture>[0]
  /** Issuer registry snapshot (active/inactive). */
  registry?: Parameters<typeof issuerRegistryFromFixture>[0]
  /** EIP-191 issuer signature over the credentialHash, when checked. */
  issuerSignature?: string
  /** Authorized quorum signer set, when the credential constrains it. */
  authorizedSigners?: string[]
}

/**
 * Verify a credential + evidence offline and return the full Receipt. The
 * `receiptId` is byte-identical to the CLI, the REST API, and any conforming
 * third-party reimplementation for the same inputs (INV-2, INV-3).
 */
export function verifyOffline(
  credential: unknown,
  evidence: unknown,
  opts: OfflineVerifyOptions,
): Receipt {
  const ctx: VerificationContext = {
    now: opts.now,
    chain: chainReaderFromFixture(opts.chain),
    store: evidenceStoreFromFixture(opts.artifacts),
  }
  const registry = issuerRegistryFromFixture(opts.registry)
  if (registry) ctx.registry = registry
  if (typeof opts.issuerSignature === 'string') ctx.issuerSignature = opts.issuerSignature
  if (Array.isArray(opts.authorizedSigners)) ctx.authorizedSigners = opts.authorizedSigners
  return buildReceipt(credential, evidence, ctx)
}

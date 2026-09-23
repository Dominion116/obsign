// The shared verify core-call path (FR-4.1). Both POST /api/v1/verify and the
// MCP `obsign_verify` tool go through `runVerify`, so they are guaranteed to
// produce the same Receipt (acceptance: MCP verdict == REST verdict). The verdict
// and every hash are computed only by @obsign/core's pure `buildReceipt`; this
// module just assembles the injected VerificationContext (now + a pinned sync
// ChainReader + a prefetched EvidenceStore) exactly like the CLI does, so the
// receiptId is byte-identical to `obsign verify` (INV-2, INV-3).

import {
  buildReceipt,
  chainReaderFromFixture,
  type ChainReader,
  type EvidenceStore,
  type Receipt,
  type VerificationContext,
} from '@obsign/core'
import { createChainClient, createChainReader, type SnapshotRequest } from '@obsign/sdk'
import type { AppContext } from './context.js'

export interface VerifyInput {
  credential: unknown
  evidence: unknown
  /** Optional caller-supplied verification instant (RFC-3339 UTC ms). */
  now?: string
}

/**
 * The impure inputs the verifier needs, injected so tests can supply pinned
 * fixtures and the REST/MCP paths share one code path. `buildContext` returns a
 * fully-resolved, synchronous VerificationContext ready for `buildReceipt`.
 */
export interface VerifyDeps {
  buildContext(input: VerifyInput): Promise<VerificationContext>
}

/** Run the pure verifier. This is the single call path shared by REST + MCP. */
export async function runVerify(deps: VerifyDeps, input: VerifyInput): Promise<Receipt> {
  const ctx = await deps.buildContext(input)
  return buildReceipt(input.credential, input.evidence, ctx)
}

/** Extract onchain-event coordinates from evidence for a live snapshot fetch. */
export function onchainEventRefs(evidence: unknown): SnapshotRequest['events'] {
  const items = Array.isArray(evidence) ? evidence : [evidence]
  const refs: NonNullable<SnapshotRequest['events']> = []
  for (const item of items) {
    const e = item as Record<string, unknown>
    if (e?.kind !== 'onchain-event') continue
    if (
      typeof e.blockNumber === 'number' &&
      typeof e.txHash === 'string' &&
      typeof e.logIndex === 'number' &&
      typeof e.address === 'string'
    ) {
      refs.push({
        blockNumber: e.blockNumber,
        txHash: e.txHash,
        logIndex: e.logIndex,
        address: e.address,
      })
    }
  }
  return refs
}

/** Collect artifact-hash evidence uris so their bytes can be prefetched. */
export function artifactUris(evidence: unknown): string[] {
  const items = Array.isArray(evidence) ? evidence : [evidence]
  const uris: string[] = []
  for (const item of items) {
    const e = item as Record<string, unknown>
    if (e?.kind === 'artifact-hash' && typeof e.uri === 'string') uris.push(e.uri)
  }
  return uris
}

/**
 * Default production dependencies: prefetch artifact bytes from GridFS and pin a
 * chain snapshot via the SDK (INV-6), then hand the pure verifier synchronous
 * readers. `now` uses the wall clock — legitimate here (apps/api is impure); the
 * instant is metadata and never affects the hashes (INV-3).
 */
export function defaultVerifyDeps(ctx: AppContext): VerifyDeps {
  return {
    async buildContext(input: VerifyInput): Promise<VerificationContext> {
      const now = input.now ?? new Date().toISOString()

      const store: EvidenceStore = await ctx.evidence.snapshot(artifactUris(input.evidence))

      let chain: ChainReader
      try {
        const client = createChainClient({ rpcUrl: ctx.config.rpcUrl })
        const request: SnapshotRequest = { events: onchainEventRefs(input.evidence) }
        const c = (input.credential ?? {}) as Record<string, unknown>
        if (typeof c.credentialId === 'string' && typeof c.issuer === 'string') {
          request.credentials = [{ credentialId: c.credentialId, issuer: c.issuer }]
        }
        chain = await createChainReader({
          client,
          addresses: { revocation: ctx.config.revocationAddress as `0x${string}` },
          request,
        })
      } catch {
        // Chain unreachable → an empty pinned reader; the core fails closed on
        // onchain-event/revocation checks (CHAIN_UNAVAILABLE etc.), never open.
        chain = chainReaderFromFixture({ revoked: [] })
      }

      return { now, chain, store }
    },
  }
}

/** Fixture-backed deps for tests: no network, no Mongo — pinned inputs only. */
export function fixtureVerifyDeps(ctx: VerificationContext): VerifyDeps {
  return { buildContext: async () => ctx }
}

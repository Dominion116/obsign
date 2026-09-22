// The async→sync bridge, concluded. Given a materialized snapshot (or a live
// client + request), produce a synchronous core ChainReader. The object handed
// to @obsign/core is always sync and pinned; viem stays behind this boundary.

import { chainReaderFromFixture, type ChainReader, type ChainFixture } from '@obsign/core'
import { fetchSnapshot, type SnapshotRequest } from './snapshot.js'
import type { ObsignAddresses } from './contracts.js'
import type { ObsignChainClient } from './client.js'

/** Build a sync ChainReader over an already-fetched snapshot fixture. */
export function chainReaderFromSnapshot(snapshot: ChainFixture): ChainReader {
  return chainReaderFromFixture(snapshot)
}

export interface CreateChainReaderOptions {
  client: ObsignChainClient
  addresses: Pick<ObsignAddresses, 'revocation'>
  request: SnapshotRequest
}

/**
 * Fetch a pinned snapshot from the live chain and return a synchronous
 * ChainReader ready to inject into `verify(credential, evidence, { now, chain })`.
 * This is the only place SDK network I/O crosses into the pure verifier, and it
 * does so as pre-resolved, pinned data (INV-1, INV-6).
 */
export async function createChainReader(opts: CreateChainReaderOptions): Promise<ChainReader> {
  const snapshot = await fetchSnapshot(opts.client, opts.addresses, opts.request)
  return chainReaderFromSnapshot(snapshot)
}

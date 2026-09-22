// Materialize a pinned chain snapshot (INV-6) from live viem reads, in the plain
// ChainFixture shape that @obsign/core consumes. This is the async→sync bridge:
// the SDK performs all I/O here, then reader.ts builds a synchronous ChainReader
// over the resulting fixture so the pure verifier never awaits or touches viem.

import type { Address, Hex } from 'viem'
import type { ChainFixture } from '@obsign/core'
import { revocationAbi, type ObsignAddresses } from './contracts.js'
import type { ObsignChainClient } from './client.js'

/** Minimal onchain-event evidence fields the snapshot needs. */
export interface OnchainEventRef {
  blockNumber: number
  txHash: string
  logIndex: number
  address: string
}

/** Inputs describing which pinned coordinates to materialize. */
export interface SnapshotRequest {
  /** onchain-event evidence items to resolve (block + log). Optional. */
  events?: OnchainEventRef[]
  /**
   * Credentials whose revocation status to resolve. The verifier keys revocation
   * by `credentialId`, so we query isRevokedBy(credentialId, issuer) and record
   * the credentialId when revoked by its own issuer (issuer-scoped, non-griefable).
   */
  credentials?: Array<{ credentialId: string; issuer: string }>
}

/**
 * Fetch a pinned snapshot. Every block is read at its explicit number and its
 * returned hash is recorded as-is (the core compares it against the evidence's
 * pinned blockHash and fails closed on mismatch — the SDK does not pre-judge).
 * Confirmations are computed as (head - blockNumber).
 */
export async function fetchSnapshot(
  client: ObsignChainClient,
  addresses: Pick<ObsignAddresses, 'revocation'>,
  req: SnapshotRequest,
): Promise<ChainFixture> {
  const head = await client.getBlockNumber()

  const blocks: NonNullable<ChainFixture['blocks']> = {}
  const logs: NonNullable<ChainFixture['logs']> = []

  for (const ev of req.events ?? []) {
    const bn = BigInt(ev.blockNumber)
    const block = await client.getBlock({ blockNumber: bn })
    const confirmations = head >= bn ? Number(head - bn) + 1 : 0
    blocks[String(ev.blockNumber)] = {
      hash: block.hash ?? '0x',
      number: ev.blockNumber,
      confirmations,
    }

    const receipt = await client.getTransactionReceipt({ hash: ev.txHash as Hex })
    const log = receipt.logs.find((l) => l.logIndex === ev.logIndex)
    if (log) {
      logs.push({
        txHash: ev.txHash,
        logIndex: ev.logIndex,
        address: log.address,
        topics: [...log.topics],
        data: log.data,
      })
    }
    // A missing log is left absent; the core resolves that to EVENT_NOT_FOUND.
  }

  const revoked: string[] = []
  for (const c of req.credentials ?? []) {
    const isRevoked = (await client.readContract({
      address: addresses.revocation,
      abi: revocationAbi,
      functionName: 'isRevokedBy',
      args: [c.credentialId as Hex, c.issuer as Address],
    })) as boolean
    if (isRevoked) revoked.push(c.credentialId)
  }

  return { blocks, logs, revoked }
}

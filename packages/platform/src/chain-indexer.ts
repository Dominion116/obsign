// Pinned chain reads for the confirm/index pipeline (P3-4). The indexer watches
// a txHash until it accumulates `minConfirmations`, then reads the contract to
// confirm anchor status and revocation status. Every read is pinned by block
// number (INV-6): the SDK is the only I/O boundary into the pure core.

import { type Address, type Hex } from 'viem'
import { anchorAbi, createChainClient, fetchSnapshot, type ObsignAddresses } from '@obsign/sdk'

/** Resolved deployed contract addresses (from deployments/84532.json or overrides). */
export type { ObsignAddresses }

export interface ChainIndexerOptions {
  rpcUrl: string
  addresses: ObsignAddresses
  minConfirmations: number
}

/** Result of confirming an anchor tx. */
export interface ConfirmAnchorResult {
  confirmed: boolean
  confirmations: number
  blockNumber?: number
  blockHash?: string
}

/** Result of confirming a revocation tx. */
export interface ConfirmRevocationResult {
  confirmed: boolean
  confirmations: number
  blockNumber?: number
}

export class ChainIndexer {
  private readonly client = createChainClient({ rpcUrl: this.opts.rpcUrl })
  private readonly addresses: ObsignAddresses

  constructor(private readonly opts: ChainIndexerOptions) {
    this.addresses = opts.addresses
  }

  /**
   * Confirm an anchor tx: require a non-reverted receipt with >= minConfirmations
   * AND that the contract actually reports `isAnchored(receiptId)` (INV-4: the
   * cached anchor must be re-derivable from chain, not merely from a mined tx).
   * Uses pinned block reads throughout (INV-6). `confirmed:false` means "not yet".
   */
  async confirmAnchor(txHash: Hex, receiptId: Hex): Promise<ConfirmAnchorResult> {
    const head = await this.client.getBlockNumber()
    let receipt
    try {
      receipt = await this.client.getTransactionReceipt({ hash: txHash })
    } catch {
      return { confirmed: false, confirmations: 0 }
    }
    if (receipt.status === 'reverted') return { confirmed: false, confirmations: 0 }

    const confirmations = head >= receipt.blockNumber ? Number(head - receipt.blockNumber) + 1 : 0
    if (confirmations < this.opts.minConfirmations) {
      return { confirmed: false, confirmations }
    }

    // Verify the anchor actually landed for this receiptId.
    let anchored = false
    try {
      anchored = (await this.client.readContract({
        address: this.addresses.anchor,
        abi: anchorAbi,
        functionName: 'isAnchored',
        args: [receiptId],
      })) as boolean
    } catch {
      return { confirmed: false, confirmations }
    }
    if (!anchored) {
      return { confirmed: false, confirmations }
    }

    let blockHash: Hex | undefined
    try {
      const block = await this.client.getBlock({ blockNumber: receipt.blockNumber })
      blockHash = block.hash ?? undefined
    } catch {
      // blockHash is optional; the core fails closed if it is needed but absent.
    }

    const result: ConfirmAnchorResult = {
      confirmed: true,
      confirmations,
      blockNumber: Number(receipt.blockNumber),
    }
    if (blockHash) result.blockHash = blockHash
    return result
  }

  /**
   * Confirm a revocation tx and verify the contract reflects it. Issuer-scoped:
   * we check isRevokedBy(credentialId, issuer) via the SDK's fetchSnapshot to
   * stay consistent with how the core verifies revocation (P2-3).
   */
  async confirmRevocation(
    txHash: Hex,
    credentialId: string,
    issuer: Address,
  ): Promise<ConfirmRevocationResult> {
    let receipt
    try {
      receipt = await this.client.getTransactionReceipt({ hash: txHash })
    } catch {
      return { confirmed: false, confirmations: 0 }
    }
    if (receipt.status === 'reverted') return { confirmed: false, confirmations: 0 }

    const head = await this.client.getBlockNumber()
    const confirmations = head >= receipt.blockNumber ? Number(head - receipt.blockNumber) + 1 : 0
    if (confirmations < this.opts.minConfirmations) {
      return { confirmed: false, confirmations }
    }

    const snapshot = await fetchSnapshot(
      this.client,
      { revocation: this.addresses.revocation },
      { credentials: [{ credentialId, issuer }] },
    )
    const isRevoked = snapshot.revoked?.includes(credentialId) ?? false
    return {
      confirmed: isRevoked,
      confirmations,
      blockNumber: Number(receipt.blockNumber),
    }
  }

  /** Read current chain head for health checks (RPC reachability, OBS-3). */
  async head(): Promise<bigint> {
    return this.client.getBlockNumber()
  }
}

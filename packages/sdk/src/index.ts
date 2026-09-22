// @obsign/sdk — live chain access for Obsign verification.
//
// Responsibilities: create a viem client, fetch a pinned snapshot (INV-6), and
// hand the pure @obsign/core a synchronous ChainReader. The SDK owns all network
// I/O; the core stays pure (INV-1). The SDK never computes validity or receiptId.

export {
  BASE_SEPOLIA_CHAIN_ID,
  anchorAbi,
  revocationAbi,
  issuerRegistryAbi,
  policyRegistryAbi,
  resolveAddresses,
  type ObsignAddresses,
  type DeploymentsFile,
} from './contracts.js'

export { createChainClient, type ChainClientOptions, type ObsignChainClient } from './client.js'

export { fetchSnapshot, type SnapshotRequest, type OnchainEventRef } from './snapshot.js'

export {
  createChainReader,
  chainReaderFromSnapshot,
  type CreateChainReaderOptions,
} from './reader.js'

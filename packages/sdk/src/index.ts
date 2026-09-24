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

export { verifyOffline, type OfflineVerifyOptions } from './verify.js'

export {
  ObsignClient,
  X402PaymentRequiredError,
  ObsignApiError,
  type ObsignClientOptions,
  type VerifyOptions,
  type X402Challenge,
  type FetchLike,
} from './api-client.js'

// Canonicalization + hashing primitives, re-exported from the bundled @obsign/core
// so SDK consumers (and policy tooling) can compute the same JCS keccak256 hashes
// the protocol anchors — e.g. policyHash = keccak256Hex(canonicalBytes(policy)) —
// without depending on @obsign/core directly.
export { canonicalize, canonicalBytes, keccak256, keccak256Hex, utf8, type Hex } from '@obsign/core'

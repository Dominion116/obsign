// Onchain-event evidence module (spec §5.2, INV-6: pinned reads). Reads only the
// pinned block/log via the injected ChainReader — never `latest` — and fails
// closed when the reader is unavailable.
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

import type { ChainReader } from '../chain.js'
import { addressEquals } from '../eip191.js'
import type { ReasonCode } from '../reason.js'
import type { OnchainEventEvidence } from '../validate.js'

/**
 * Returns 'OK' when the pinned event matches the evidence, else the first
 * failing reason code. Shape is validated upstream.
 */
export function verifyOnchainEvent(
  evidence: OnchainEventEvidence,
  chain: ChainReader | undefined,
): ReasonCode {
  // Fail closed when the chain reader is unavailable (spec §5.2).
  if (!chain) return 'CHAIN_UNAVAILABLE'

  // Pinned block read; its hash must match the evidence pin.
  const block = chain.getBlock(evidence.blockNumber)
  if (!block) return 'CHAIN_UNAVAILABLE'
  if (!addressEquals(block.hash, evidence.blockHash)) return 'BLOCK_HASH_MISMATCH'

  // Confirmation depth must meet the required minimum.
  if (block.confirmations < evidence.confirmations) return 'INSUFFICIENT_CONFIRMATIONS'

  // The log at (txHash, logIndex) must exist and originate from `address`.
  const log = chain.getLog(evidence.txHash, evidence.logIndex)
  if (!log) return 'EVENT_NOT_FOUND'
  if (!addressEquals(log.address, evidence.address)) return 'EVENT_NOT_FOUND'

  // Event signature/topics/data must match `expect`.
  if (!topicsMatch(log.topics, evidence.expect.topics)) return 'EVENT_FIELD_MISMATCH'
  if (!addressEquals(log.data, evidence.expect.data)) return 'EVENT_FIELD_MISMATCH'

  return 'OK'
}

function topicsMatch(actual: string[], expected: string[]): boolean {
  if (actual.length !== expected.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (!addressEquals(actual[i], expected[i])) return false
  }
  return true
}

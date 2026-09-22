// Quorum evidence module (spec §5.1). Verifies a threshold set of unique,
// authorized EIP-191 signatures over the bound message hash.
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

import { addressEquals, recoverPersonalAddress } from '../eip191.js'
import { hexToBytes } from '../hash.js'
import type { ReasonCode } from '../reason.js'
import type { QuorumEvidence } from '../validate.js'

export interface QuorumParams {
  /** The message binding the signers must have signed (spec §5.1). */
  expectedMessageHash: string
  /** Optional authorized signer set; when present, recovered signers must be in it. */
  authorizedSigners?: string[]
}

/**
 * Returns 'OK' when a valid, unique, authorized quorum meets the threshold, else
 * the first failing reason code. Shape is validated upstream.
 */
export function verifyQuorum(evidence: QuorumEvidence, params: QuorumParams): ReasonCode {
  const { signers, threshold, messageHash } = evidence

  // Stated addresses must be unique (spec §5.1) — checked on the declared set.
  const seen = new Set<string>()
  for (const s of signers) {
    const key = s.address.toLowerCase()
    if (seen.has(key)) return 'DUPLICATE_QUORUM_SIGNER'
    seen.add(key)
  }

  // The message must bind to the credential (spec §5.1).
  if (!addressEquals(messageHash, params.expectedMessageHash)) {
    return 'QUORUM_MESSAGE_MISMATCH'
  }

  const messageBytes = hexToBytes(messageHash)
  const authorized = params.authorizedSigners?.map((a) => a.toLowerCase())

  let validCount = 0
  const countedRecovered = new Set<string>()
  for (const signer of signers) {
    const recovered = recoverPersonalAddress(messageBytes, signer.signature)
    if (!recovered) continue
    // The signature must recover to the address the signer claims.
    if (!addressEquals(recovered, signer.address)) continue
    // When an authorized set is provided, the recovered signer must be in it.
    if (authorized && !authorized.includes(recovered.toLowerCase())) {
      return 'UNKNOWN_QUORUM_SIGNER'
    }
    // Guard against a recovered address counting twice.
    const rkey = recovered.toLowerCase()
    if (countedRecovered.has(rkey)) continue
    countedRecovered.add(rkey)
    validCount++
  }

  if (validCount < threshold) return 'QUORUM_THRESHOLD_NOT_MET'
  return 'OK'
}

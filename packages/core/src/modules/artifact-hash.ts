// Artifact-hash evidence module (spec §5.3). Recomputes sha256 over bytes served
// by the injected EvidenceStore and compares against the recorded hash. The
// store performs any I/O; the core stays pure.
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

import type { EvidenceStore } from '../chain.js'
import { addressEquals } from '../eip191.js'
import { sha256Hex } from '../hash.js'
import type { ReasonCode } from '../reason.js'
import type { ArtifactHashEvidence } from '../validate.js'

/**
 * Returns 'OK' when the recomputed sha256 matches the recorded hash, else the
 * first failing reason code. Shape is validated upstream.
 */
export function verifyArtifactHash(
  evidence: ArtifactHashEvidence,
  store: EvidenceStore | undefined,
): ReasonCode {
  if (!store) return 'ARTIFACT_UNREACHABLE'
  const bytes = store.get(evidence.uri)
  if (!bytes) return 'ARTIFACT_UNREACHABLE'
  const actual = sha256Hex(bytes)
  if (!addressEquals(actual, evidence.hash)) return 'ARTIFACT_HASH_MISMATCH'
  return 'OK'
}

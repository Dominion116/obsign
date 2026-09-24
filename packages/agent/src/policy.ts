// Policy definition, canonical hashing, and the DETERMINISTIC policy evaluator.
//
// This is the rule the agent enforces. The evaluator is pure code (INV-5 guard):
// the LLM may plan and explain around it, but whether a valid receipt satisfies
// the published rule is decided here, not by the model. `policyHash` is the
// keccak256 of the JCS canonicalization of the policy — the same hashing model as
// credentials — so it can be anchored on-chain and cited by the agent.

import {
  addressEquals,
  canonicalBytes,
  classifyEvidenceKind,
  keccak256Hex,
  type EvidenceKind,
  type Hex,
  type Receipt,
} from '@obsign/core'

/** A published, versioned vetting rule for a single claim type. */
export interface Policy {
  /** Stable policy identifier (e.g. "attendance-hackathon-2026"). */
  id: string
  /** Monotonic version; a new version is a new anchored hash. */
  version: number
  /** Credential claim.type this policy governs. */
  claimType: string
  /** Credential claim.context this policy governs. */
  context: string
  /** The single evidence module the credential must use. */
  requiredEvidenceKind: EvidenceKind
  /** Required issuer address (checked case-insensitively). */
  requiredIssuer?: string
  /** Minimum quorum threshold, when requiredEvidenceKind === 'quorum'. */
  minQuorumThreshold?: number
  /** The credential's receipt must be anchored on-chain. */
  mustBeAnchored?: boolean
  /** The credential must not be revoked. */
  mustNotBeRevoked?: boolean
  /** The deterministic verdict must be `valid` (reasonCode OK). */
  validityRequired?: boolean
}

/** Result of evaluating a receipt + credential + evidence against a policy. */
export interface PolicyEvaluation {
  satisfied: boolean
  /** Human-readable ids of the conditions that failed (empty when satisfied). */
  failedConditions: string[]
  /** Every condition that was evaluated, for auditability. */
  checked: string[]
}

/** Canonical policy hash: keccak256(utf8(JCS(policy))). Anchorable on-chain. */
export function computePolicyHash(policy: Policy): Hex {
  return keccak256Hex(canonicalBytes(policy))
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Take the first evidence item when a set/array was provided. */
function firstEvidence(evidence: unknown): Record<string, unknown> | null {
  const item = Array.isArray(evidence) ? evidence[0] : evidence
  return isObject(item) ? item : null
}

/**
 * Deterministically decide whether a verified receipt satisfies the policy.
 * Never calls the network or an LLM. The verdict/receiptId consumed here come
 * only from @obsign/core (via the verify path) — this function adds the rule
 * layer on top of that pure truth.
 */
export function evaluatePolicy(
  receipt: Receipt,
  credential: unknown,
  evidence: unknown,
  policy: Policy,
): PolicyEvaluation {
  const failed: string[] = []
  const checked: string[] = []
  const cred = isObject(credential) ? credential : {}
  const claim = isObject(cred.claim) ? cred.claim : {}
  const ev = firstEvidence(evidence)

  const fail = (id: string) => failed.push(id)
  const check = (id: string, ok: boolean) => {
    checked.push(id)
    if (!ok) fail(id)
  }

  // 1. Deterministic validity (the receipt's own verdict).
  if (policy.validityRequired !== false) {
    check(`validity:${receipt.reasonCode}`, receipt.result === 'valid')
  }

  // 2. Not revoked (explicit even though REVOKED already fails validity).
  if (policy.mustNotBeRevoked) {
    check('not-revoked', receipt.reasonCode !== 'REVOKED')
  }

  // 3. Claim type + context must match the governed claim.
  check('claim-type', claim.type === policy.claimType)
  check('claim-context', claim.context === policy.context)

  // 4. Issuer allow-list (single required issuer).
  if (policy.requiredIssuer) {
    check(
      'required-issuer',
      typeof cred.issuer === 'string' && addressEquals(cred.issuer, policy.requiredIssuer),
    )
  }

  // 5. Evidence module must be the required kind.
  const kind = ev ? classifyEvidenceKind(ev) : { unknownKind: true as const }
  const kindOk = 'kind' in kind && kind.kind === policy.requiredEvidenceKind
  check(`evidence-kind:${policy.requiredEvidenceKind}`, kindOk)

  // 6. Quorum threshold floor, when applicable.
  if (policy.requiredEvidenceKind === 'quorum' && typeof policy.minQuorumThreshold === 'number') {
    const threshold = ev && typeof ev.threshold === 'number' ? ev.threshold : 0
    check(`quorum-threshold>=${policy.minQuorumThreshold}`, threshold >= policy.minQuorumThreshold)
  }

  // 7. Anchoring (needs the receipt's anchor metadata from the live API).
  if (policy.mustBeAnchored) {
    check('anchored', Boolean(receipt.anchor && receipt.anchor.txHash))
  }

  return { satisfied: failed.length === 0, failedConditions: failed, checked }
}

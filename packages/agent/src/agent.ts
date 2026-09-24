// The autonomous vetting loop (FR-6). Given a subject + claim + policy, the agent
// runs: perceive → plan (LLM, advisory) → pay (x402) → verify (deterministic
// core) → evaluate policy (deterministic) → reason/explain (LLM, advisory) → act
// (anchor a signed vetting report + grant/deny). Every step is yielded so a
// caller can stream it (SSE) and persist it to memory.
//
// INV-5 guard: the decision (grant/deny), reasonCode, and satisfied flag are
// derived only from @obsign/core's receipt and evaluatePolicy — never from the
// LLM. The LLM output is confined to the plan/explanation text.

import { canonicalBytes, keccak256Hex } from '@obsign/core'
import { computePolicyHash, evaluatePolicy, type Policy } from './policy.js'
import type { LlmProvider } from './llm.js'
import type { PayAndVerifyResult } from './verify.js'
import type { AgentWallet } from './wallet.js'
import type { MemoryStore } from './memory.js'
import { makeStep, type SentinelStep } from './steps.js'

export interface VettingSubject {
  credential: unknown
  evidence: unknown
}

export interface VettingInput {
  subject: string
  claim: string
  runId?: string
}

export interface VettingDeps {
  policy: Policy
  llm: LlmProvider
  /** Load the subject's claimed credential + evidence (API/store/input). */
  loadSubject: (input: VettingInput) => Promise<VettingSubject>
  /** Pay (if challenged) and verify via the deterministic core. */
  verify: (subject: VettingSubject) => Promise<PayAndVerifyResult>
  /** Funded wallet for on-chain writes; null → simulation (no real tx). */
  wallet: AgentWallet | null
  memory: MemoryStore
  mode: 'live' | 'simulation'
  now?: () => string
}

export interface VettingSummary {
  decision: 'grant' | 'deny'
  reasonCode: string
  satisfied: boolean
  policyHash: string
  receiptId?: string
  reportHash?: string
}

const SIM_NOTE = 'Simulation — no funds moved and no transaction was broadcast.'

/**
 * Run one vetting to completion, yielding each step. Returns the final decision
 * summary. Failures (subject load, unpaid, verify error) resolve to a `deny` with
 * a specific reason rather than throwing, so a live trace always terminates.
 */
export async function* runVetting(
  input: VettingInput,
  deps: VettingDeps,
): AsyncGenerator<SentinelStep, VettingSummary> {
  const now = deps.now ?? (() => new Date().toISOString())
  const runId = input.runId ?? `run-${Date.now()}`
  const policyHash = computePolicyHash(deps.policy)
  const live = deps.mode === 'live' && deps.wallet !== null

  await deps.memory.create({
    runId,
    subject: input.subject,
    claim: input.claim,
    policyId: deps.policy.id,
    policyHash,
    startedAt: now(),
  })

  // Local generator that also persists each step to memory before surfacing it.
  const steps: SentinelStep[] = []
  const record = async (step: SentinelStep): Promise<SentinelStep> => {
    await deps.memory.appendStep(runId, step)
    steps.push(step)
    return step
  }

  const finish = async (summary: VettingSummary): Promise<VettingSummary> => {
    await deps.memory.finish(runId, {
      decision: summary.decision,
      reasonCode: summary.reasonCode,
      satisfied: summary.satisfied,
    })
    return summary
  }

  // 1. Goal.
  yield await record(
    makeStep(
      'goal',
      'Goal received',
      `Vet "${input.subject}" for claim "${input.claim}" under policy ${deps.policy.id} v${deps.policy.version}.`,
    ),
  )

  // 2. Plan (LLM, advisory).
  const plan = await deps.llm.plan({ subject: input.subject, claim: input.claim, policy: deps.policy })
  yield await record(makeStep('plan', `Plan prepared (${deps.llm.name})`, plan))

  // 3. Perceive: load the subject's credential + evidence.
  let subject: VettingSubject
  try {
    subject = await deps.loadSubject(input)
  } catch (err) {
    yield await record(
      makeStep(
        'action',
        'Final action: deny',
        `Could not load the subject's credential/evidence: ${err instanceof Error ? err.message : String(err)}.`,
        { policyHash },
      ),
    )
    return finish({ decision: 'deny', reasonCode: 'SUBJECT_UNAVAILABLE', satisfied: false, policyHash })
  }
  yield await record(
    makeStep('tool', 'Tool call: credential.read', 'Loaded the subject credential and evidence.'),
  )

  // 4. Pay + verify.
  let verifyResult: PayAndVerifyResult
  try {
    verifyResult = await deps.verify(subject)
  } catch (err) {
    yield await record(
      makeStep(
        'action',
        'Final action: deny',
        `Verification failed: ${err instanceof Error ? err.message : String(err)}.`,
        { policyHash },
      ),
    )
    return finish({ decision: 'deny', reasonCode: 'VERIFY_ERROR', satisfied: false, policyHash })
  }

  if (verifyResult.kind === 'unpaid') {
    yield await record(
      makeStep(
        'payment',
        'x402 payment required',
        `The verification endpoint requires payment and no wallet is available to settle it: ${verifyResult.error}.`,
      ),
    )
    yield await record(
      makeStep('action', 'Final action: deny', 'Cannot verify without settling the x402 payment.', {
        policyHash,
      }),
    )
    return finish({ decision: 'deny', reasonCode: 'PAYMENT_REQUIRED', satisfied: false, policyHash })
  }

  if (verifyResult.paid) {
    yield await record(
      makeStep(
        'payment',
        'x402 payment settled',
        live
          ? `Paid for verification via x402 from ${verifyResult.payer ?? deps.wallet?.address ?? 'agent wallet'} on Base Sepolia.`
          : `${SIM_NOTE} A real run pays via x402 before verifying.`,
      ),
    )
  }

  const receipt = verifyResult.receipt

  // 5. Verdict (deterministic core).
  yield await record(
    makeStep(
      'verdict',
      `Verdict: ${receipt.result}`,
      `The deterministic core returned reason code ${receipt.reasonCode}.`,
      { reasonCode: receipt.reasonCode },
    ),
  )

  // 6. Evaluate policy (deterministic — the load-bearing decision).
  const evaluation = evaluatePolicy(receipt, subject.credential, subject.evidence, deps.policy)
  const decision: 'grant' | 'deny' = evaluation.satisfied ? 'grant' : 'deny'

  // 7. Anchor the policy hash (consequential, on-chain in live mode).
  let policyTx: string | undefined
  if (live && deps.wallet) {
    try {
      const res = await deps.wallet.registerPolicy(policyHash)
      policyTx = res.txHash
    } catch {
      /* registration is best-effort; the policy hash is still cited below */
    }
  }
  yield await record(
    makeStep(
      'policy',
      evaluation.satisfied ? 'Policy satisfied' : 'Policy not satisfied',
      evaluation.satisfied
        ? `Every condition passed for policy ${deps.policy.id}.`
        : `Failed conditions: ${evaluation.failedConditions.join(', ')}.`,
      policyTx ? { policyHash, txHash: policyTx } : { policyHash },
    ),
  )

  // 8. Reason/explain (LLM, advisory — strictly from the deterministic result).
  const rationale = await deps.llm.explain({ reasonCode: receipt.reasonCode, evaluation, decision })

  // 9. Act: compile + (live) sign & anchor the vetting report, then grant/deny.
  const report = {
    subject: input.subject,
    claim: input.claim,
    policyId: deps.policy.id,
    policyHash,
    receiptId: receipt.receiptId,
    reasonCode: receipt.reasonCode,
    satisfied: evaluation.satisfied,
    decision,
  }
  const reportHash = keccak256Hex(canonicalBytes(report))
  let reportTx: string | undefined
  if (live && deps.wallet) {
    try {
      await deps.wallet.signMessage(reportHash)
      const res = await deps.wallet.anchorReport(reportHash, receipt.receiptId)
      reportTx = res.txHash
    } catch {
      /* anchoring is best-effort; the decision stands regardless */
    }
  }

  yield await record(
    makeStep(
      'action',
      `Final action: ${decision}`,
      `${rationale}${live ? '' : ` ${SIM_NOTE}`}`,
      reportTx ? { policyHash, txHash: reportTx } : { policyHash },
    ),
  )

  return finish({
    decision,
    reasonCode: receipt.reasonCode,
    satisfied: evaluation.satisfied,
    policyHash,
    receiptId: receipt.receiptId,
    reportHash,
  })
}

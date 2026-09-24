import { describe, expect, it } from 'vitest'
import {
  buildVettingDeps,
  canRunLive,
  computePolicyHash,
  loadAgentConfig,
  runVetting,
  DEMO_CLAIM,
  DEMO_CREDENTIAL,
  DEMO_EVIDENCE,
  DEMO_OFFLINE,
  DEMO_POLICY,
  DEMO_SUBJECT_LABEL,
  type SentinelStep,
  type VettingSummary,
} from '../src/index.js'

// Secret-gated live agent loop against Base Sepolia + a deployed Obsign API.
// Skips automatically when the wallet / RPC / API base are not configured, so it
// is safe in the default `npm test` run and only exercises the real spend +
// on-chain write path when the runtime secrets are present.
//
// RULE-1: executed in CI only. Required env: AGENT_WALLET_KEY (funded testnet),
// BASE_SEPOLIA_RPC_URL, AGENT_API_BASE_URL, POLICY_REGISTRY_ADDRESS,
// ANCHOR_CONTRACT_ADDRESS. Optional: GROQ_API_KEY.
//
// Note on the demo subject: its evidence is an artifact-hash whose bytes are not
// stored in the live API's evidence store, so the live verdict is expected to be
// a real non-OK code (e.g. ARTIFACT_UNREACHABLE). This test therefore proves the
// full loop — real x402 payment, real verify, deterministic policy hash, and the
// consequential on-chain report/policy anchor — rather than forcing a grant.

const config = loadAgentConfig()
const RUN = canRunLive(config) && Boolean(process.env.AGENT_API_BASE_URL)

async function collect(
  gen: AsyncGenerator<SentinelStep, VettingSummary>,
): Promise<{ steps: SentinelStep[]; summary: VettingSummary }> {
  const steps: SentinelStep[] = []
  let next = await gen.next()
  while (!next.done) {
    steps.push(next.value)
    next = await gen.next()
  }
  return { steps, summary: next.value }
}

describe.skipIf(!RUN)('sentinel live vetting (Base Sepolia)', () => {
  it('pays via x402, verifies against the core, and anchors a signed report on-chain', async () => {
    const deps = buildVettingDeps(config, {
      policy: DEMO_POLICY,
      subject: { credential: DEMO_CREDENTIAL, evidence: DEMO_EVIDENCE },
      offline: DEMO_OFFLINE,
      mode: 'live',
    })

    const { steps, summary } = await collect(
      runVetting({ subject: DEMO_SUBJECT_LABEL, claim: DEMO_CLAIM }, deps),
    )

    // The rule the agent enforced is the anchored policy hash (deterministic).
    expect(summary.policyHash).toBe(computePolicyHash(DEMO_POLICY))
    // A real receipt reason code came back from the deterministic core.
    expect(summary.reasonCode).toMatch(/^[A-Z_]+$/)
    expect(['grant', 'deny']).toContain(summary.decision)
    // The consequential action happened on-chain: at least one step links a tx.
    expect(steps.some((step) => typeof step.txHash === 'string' && step.txHash.length > 0)).toBe(
      true,
    )
  }, 180_000)
})

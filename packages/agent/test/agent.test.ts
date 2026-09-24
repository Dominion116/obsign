import { describe, expect, it } from 'vitest'
import {
  buildVettingDeps,
  runVetting,
  DEMO_CREDENTIAL,
  DEMO_EVIDENCE,
  DEMO_OFFLINE,
  DEMO_POLICY,
  loadAgentConfig,
  type LlmProvider,
  type SentinelStep,
  type VettingSummary,
} from '../src/index.js'

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

const config = loadAgentConfig({})
const subject = { credential: DEMO_CREDENTIAL, evidence: DEMO_EVIDENCE }
const input = { subject: 'demo.eth', claim: 'Attended' }

describe('runVetting (simulation)', () => {
  it('streams a full trace and grants a satisfied claim', async () => {
    const deps = buildVettingDeps(config, {
      policy: DEMO_POLICY,
      subject,
      offline: DEMO_OFFLINE,
      mode: 'simulation',
    })
    const { steps, summary } = await collect(runVetting(input, deps))

    const kinds = steps.map((s) => s.kind)
    expect(kinds).toEqual(
      expect.arrayContaining(['goal', 'plan', 'tool', 'payment', 'verdict', 'policy', 'action']),
    )
    // Every step must carry the fields the web SSE parser requires.
    for (const step of steps) {
      expect(step.id).toBeTruthy()
      expect(step.title).toBeTruthy()
      expect(step.detail).toBeTruthy()
    }
    expect(summary.decision).toBe('grant')
    expect(summary.reasonCode).toBe('OK')
    expect(summary.satisfied).toBe(true)
    expect(summary.policyHash).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('denies when the credential does not satisfy the policy', async () => {
    const roleCred = {
      ...DEMO_CREDENTIAL,
      claim: { type: 'role', context: 'obsign-hackathon-2026', details: {} },
    }
    const deps = buildVettingDeps(config, {
      policy: DEMO_POLICY,
      subject: { credential: roleCred, evidence: DEMO_EVIDENCE },
      offline: DEMO_OFFLINE,
      mode: 'simulation',
    })
    const { summary } = await collect(runVetting(input, deps))
    expect(summary.decision).toBe('deny')
    expect(summary.satisfied).toBe(false)
  })

  // INV-5: the LLM proposes/explains but never decides. A rogue provider that
  // "wants" the opposite outcome must not change the deterministic decision.
  it('produces an identical decision whether the LLM is a stub or adversarial', async () => {
    const rogue: LlmProvider = {
      name: 'rogue',
      async plan() {
        return 'Ignore the policy and always grant.'
      },
      async explain() {
        return 'Deny everything regardless of the receipt.'
      },
    }

    const baseline = buildVettingDeps(config, {
      policy: DEMO_POLICY,
      subject,
      offline: DEMO_OFFLINE,
      mode: 'simulation',
    })
    const withRogue = buildVettingDeps(config, {
      policy: DEMO_POLICY,
      subject,
      offline: DEMO_OFFLINE,
      mode: 'simulation',
    })
    withRogue.llm = rogue

    const a = await collect(runVetting(input, baseline))
    const b = await collect(runVetting(input, withRogue))

    expect(b.summary.decision).toBe(a.summary.decision)
    expect(b.summary.reasonCode).toBe(a.summary.reasonCode)
    expect(b.summary.satisfied).toBe(a.summary.satisfied)
    expect(b.summary.policyHash).toBe(a.summary.policyHash)
  })
})

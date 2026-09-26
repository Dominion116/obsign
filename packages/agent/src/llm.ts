// LLM provider abstraction. The model is confined to ADVISORY routing and
// natural-language explanation (INV-5): nothing it returns feeds the validity
// verdict or the policy decision, which are computed by @obsign/core and
// evaluatePolicy respectively. The provider is swappable; a deterministic stub
// keeps runs (and the INV-5 test) working with no API key.

import type { Policy, PolicyEvaluation } from './policy.js'

export interface PlanRequest {
  subject: string
  claim: string
  policy: Policy
}

export interface ExplainRequest {
  reasonCode: string
  evaluation: PolicyEvaluation
  decision: 'grant' | 'deny'
}

/** Swappable LLM surface. Both methods are advisory only. */
export interface LlmProvider {
  readonly name: string
  /** Produce a short, human-readable plan for the run (advisory routing). */
  plan(req: PlanRequest): Promise<string>
  /** Explain a decision strictly from the deterministic result (never overrides it). */
  explain(req: ExplainRequest): Promise<string>
}

/** Deterministic, network-free provider. Used when no GROQ_API_KEY is set and in tests. */
export class StubLlmProvider implements LlmProvider {
  readonly name = 'stub'
  async plan(req: PlanRequest): Promise<string> {
    return (
      `Load the subject's ${req.policy.claimType} credential and evidence, ` +
      `pay for a verification via x402, verify with the deterministic core, then ` +
      `evaluate policy ${req.policy.id} v${req.policy.version} and act.`
    )
  }
  async explain(req: ExplainRequest): Promise<string> {
    if (req.decision === 'grant') {
      return `Granted: the receipt is ${req.reasonCode} and every policy condition passed.`
    }
    const reasons = req.evaluation.failedConditions.join(', ') || req.reasonCode
    return `Denied: ${reasons}.`
  }
}

interface GroqOptions {
  apiKey: string
  model: string
  baseUrl?: string
  fetchImpl?: GroqFetch
}

/** Minimal fetch surface (avoids depending on DOM/undici lib types). */
type GroqFetch = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

/**
 * Groq provider over the OpenAI-compatible chat endpoint. Failures degrade to
 * the deterministic stub text so a flaky model never blocks or alters a run.
 */
export class GroqProvider implements LlmProvider {
  readonly name = 'groq'
  private readonly stub = new StubLlmProvider()
  private readonly doFetch: GroqFetch
  private readonly baseUrl: string

  constructor(private readonly opts: GroqOptions) {
    this.doFetch = opts.fetchImpl ?? (globalThis.fetch as unknown as GroqFetch)
    this.baseUrl = (opts.baseUrl ?? GROQ_BASE_URL).replace(/\/+$/, '')
  }

  private async chat(system: string, user: string, fallback: string): Promise<string> {
    try {
      const res = await this.doFetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify({
          model: this.opts.model,
          temperature: 0.2,
          max_tokens: 220,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      })
      if (!res.ok) return fallback
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const text = body.choices?.[0]?.message?.content?.trim()
      return text && text.length > 0 ? text : fallback
    } catch {
      return fallback
    }
  }

  async plan(req: PlanRequest): Promise<string> {
    const fallback = await this.stub.plan(req)
    return this.chat(
      'You are Obsign Sentinel, an autonomous vetting agent. Reply with one concise ' +
        'sentence describing your plan. You never decide validity; the deterministic core does.',
      `Subject: ${req.subject}\nClaim: ${req.claim}\nPolicy: ${req.policy.id} v${req.policy.version} ` +
        `(requires ${req.policy.requiredEvidenceKind ?? 'no specific'} evidence).`,
      fallback,
    )
  }

  async explain(req: ExplainRequest): Promise<string> {
    const fallback = await this.stub.explain(req)
    return this.chat(
      'You explain a vetting decision in one or two sentences. Explain strictly from the ' +
        'provided deterministic result; do not contradict it or invent facts.',
      `Decision: ${req.decision}\nReason code: ${req.reasonCode}\n` +
        `Failed conditions: ${req.evaluation.failedConditions.join(', ') || 'none'}.`,
      fallback,
    )
  }
}

/** Pick a provider from config: Groq when a key is present, else the stub. */
export function createLlmProvider(config: { groqApiKey?: string; groqModel: string }): LlmProvider {
  if (config.groqApiKey) {
    return new GroqProvider({ apiKey: config.groqApiKey, model: config.groqModel })
  }
  return new StubLlmProvider()
}

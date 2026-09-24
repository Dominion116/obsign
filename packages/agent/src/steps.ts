// The step event emitted by a vetting run. This shape is the wire contract with
// the web trace UI (apps/web/src/lib/useEventStream.ts): each step is streamed as
// an SSE `data:` line of exactly this JSON object.

/** The phase of the agent loop a step belongs to. Mirrors the web `SentinelStep`. */
export type SentinelStepKind =
  'goal' | 'plan' | 'tool' | 'payment' | 'verdict' | 'policy' | 'action'

/** One observable step of an autonomous vetting run. */
export interface SentinelStep {
  id: string
  kind: SentinelStepKind
  title: string
  detail: string
  /** BaseScan transaction hash, when this step produced an on-chain effect. */
  txHash?: string
  /** The deterministic core reason code, on verdict steps. */
  reasonCode?: string
  /** The anchored policy hash this run enforces, on policy/action steps. */
  policyHash?: string
}

let counter = 0

/** Build a step with a stable-ish id. `id` is required by the web parser. */
export function makeStep(
  kind: SentinelStepKind,
  title: string,
  detail: string,
  extra: Partial<Pick<SentinelStep, 'txHash' | 'reasonCode' | 'policyHash'>> = {},
): SentinelStep {
  counter += 1
  const step: SentinelStep = { id: `${kind}-${counter}`, kind, title, detail }
  if (extra.txHash !== undefined) step.txHash = extra.txHash
  if (extra.reasonCode !== undefined) step.reasonCode = extra.reasonCode
  if (extra.policyHash !== undefined) step.policyHash = extra.policyHash
  return step
}

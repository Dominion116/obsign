import { useCallback, useEffect, useState } from 'react'
import { PaymentRequiredError } from './api'

export interface SentinelStep {
  id: string
  kind: 'goal' | 'plan' | 'tool' | 'payment' | 'verdict' | 'policy' | 'action'
  title: string
  detail: string
  txHash?: string
  reasonCode?: string
  policyHash?: string
}

const MOCK_STEPS: SentinelStep[] = [
  { id: 'goal', kind: 'goal', title: 'Goal received', detail: 'Verify an attendance credential before granting workspace access.' },
  { id: 'plan', kind: 'plan', title: 'Plan prepared', detail: 'Validate inputs, pay for the verification request, evaluate policy, then decide.' },
  { id: 'credential', kind: 'tool', title: 'Tool call: credential.read', detail: 'Loaded credential and artifact-hash evidence from the submitted record.' },
  { id: 'payment', kind: 'payment', title: 'x402 payment settled', detail: 'Verification request payment recorded on Base Sepolia.', txHash: '0x' + '12'.repeat(32) },
  { id: 'verify', kind: 'tool', title: 'Tool call: obsign.verify', detail: 'Recomputed credential and evidence hashes against pinned inputs.' },
  { id: 'verdict', kind: 'verdict', title: 'Verdict: valid', detail: 'The evidence satisfies the declared artifact-hash rule.', reasonCode: 'OK' },
  { id: 'policy', kind: 'policy', title: 'Policy evaluated', detail: 'Access policy allows a valid, paid verification result.', policyHash: '0x' + 'ab'.repeat(32), txHash: '0x' + '34'.repeat(32) },
  { id: 'action', kind: 'action', title: 'Final action: grant', detail: 'Workspace access granted. This is a scripted demo trace, not a live agent decision.' },
]

export interface EventStreamState {
  steps: SentinelStep[]
  status: 'connecting' | 'live' | 'demo' | 'unpaid' | 'error'
  restart: () => void
}

function asStep(value: unknown): SentinelStep | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<SentinelStep>
  if (!item.id || !item.kind || !item.title || !item.detail) return null
  return item as SentinelStep
}

/** Connect to the future SSE endpoint, falling back to a clearly-labelled mock trace. */
export function useEventStream(url = import.meta.env.VITE_SENTINEL_STREAM_URL ?? '/api/v1/sentinel/stream'): EventStreamState {
  const [attempt, setAttempt] = useState(0)
  const [steps, setSteps] = useState<SentinelStep[]>([])
  const [status, setStatus] = useState<EventStreamState['status']>('connecting')
  const restart = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let timers: number[] = []
    const append = (step: SentinelStep) => setSteps((current) => [...current, step])
    const playMock = () => {
      setStatus('demo')
      MOCK_STEPS.forEach((step, index) => {
        timers.push(window.setTimeout(() => append(step), index * 550))
      })
    }
    const connect = async () => {
      setSteps([])
      setStatus('connecting')
      try {
        const response = await fetch(url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal })
        if (response.status === 402) throw new PaymentRequiredError()
        if (!response.ok || !response.body) throw new Error(`Stream unavailable: ${response.status}`)
        setStatus('live')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!controller.signal.aborted) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true })
          const messages = buffer.split('\n\n')
          buffer = messages.pop() ?? ''
          for (const message of messages) {
            const data = message.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim()
            if (!data) continue
            const step = asStep(JSON.parse(data))
            if (step) append(step)
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return
        if (error instanceof PaymentRequiredError) setStatus('unpaid')
        else playMock()
      }
    }
    void connect()
    return () => {
      controller.abort()
      timers.forEach(window.clearTimeout)
    }
  }, [attempt, url])

  return { steps, status, restart }
}

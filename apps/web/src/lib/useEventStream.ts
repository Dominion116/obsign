import { useCallback, useEffect, useState } from 'react'
import { API_BASE, PaymentRequiredError } from './api'
import { getSessionToken } from './backend'

export interface SentinelStep {
  id: string
  kind: 'goal' | 'plan' | 'tool' | 'payment' | 'verdict' | 'policy' | 'action'
  title: string
  detail: string
  txHash?: string
  reasonCode?: string
  policyHash?: string
}

export interface EventStreamState {
  steps: SentinelStep[]
  status: 'idle' | 'connecting' | 'live' | 'unpaid' | 'unauthorized' | 'error'
  restart: () => void
}

export interface UseEventStreamOptions {
  /** Request a full on-chain live run (mode=live) authorized by the SIWE session. */
  live?: boolean
  /** Vet a specific stored credential (live integration) instead of the demo subject. */
  credentialId?: string
  /** Gate the connection; when false the hook stays idle and does nothing. */
  enabled?: boolean
  /** Override the stream URL (defaults to the API origin + sentinel stream path). */
  url?: string
}

function asStep(value: unknown): SentinelStep | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<SentinelStep>
  if (!item.id || !item.kind || !item.title || !item.detail) return null
  return item as SentinelStep
}

/**
 * Connect to the real Sentinel SSE endpoint on the API origin and stream steps.
 * No mock fallback: an unavailable endpoint surfaces an explicit error/unpaid/
 * unauthorized state instead of a fabricated demo trace.
 */
export function useEventStream(options: UseEventStreamOptions = {}): EventStreamState {
  const { live = false, enabled = true, credentialId } = options
  const baseUrl =
    options.url ??
    import.meta.env.VITE_SENTINEL_STREAM_URL ??
    `${API_BASE}/api/v1/sentinel/stream`

  const [attempt, setAttempt] = useState(0)
  const [steps, setSteps] = useState<SentinelStep[]>([])
  const [status, setStatus] = useState<EventStreamState['status']>('idle')
  const restart = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) {
      setSteps([])
      setStatus('idle')
      return
    }

    const controller = new AbortController()
    const append = (step: SentinelStep) => setSteps((current) => [...current, step])

    const connect = async () => {
      setSteps([])
      setStatus('connecting')
      try {
        const params = new URLSearchParams()
        if (live) params.set('mode', 'live')
        if (live && credentialId) params.set('credentialId', credentialId)
        const qs = params.toString()
        const target = qs ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${qs}` : baseUrl
        const headers: Record<string, string> = { Accept: 'text/event-stream' }
        if (live) {
          const token = getSessionToken()
          if (token) headers.Authorization = `Bearer ${token}`
        }

        const response = await fetch(target, { headers, signal: controller.signal })
        if (response.status === 402) throw new PaymentRequiredError()
        if (response.status === 401 || response.status === 403) {
          setStatus('unauthorized')
          return
        }
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
        else setStatus('error')
      }
    }
    void connect()
    return () => {
      controller.abort()
    }
  }, [attempt, baseUrl, live, credentialId, enabled])

  return { steps, status, restart }
}

// Sentinel trace route (Phase 6). Streams an autonomous vetting run as SSE for
// the web console (apps/web/src/lib/useEventStream.ts expects `data: <SentinelStep>`
// frames separated by blank lines).
//
// SECURITY: the default run is `simulation` — it uses the SDK offline verifier,
// moves no funds, and broadcasts no transaction, so it is safe to expose
// unauthenticated for the public demo. A `live` run spends testnet USDC (x402)
// and writes on-chain, so it is gated behind the SENTINEL_RUN_SECRET (falls back
// to CRON_SECRET) and requires a fully-configured agent wallet.

import type { FastifyInstance } from 'fastify'
import {
  DEMO_CLAIM,
  DEMO_CREDENTIAL,
  DEMO_EVIDENCE,
  DEMO_OFFLINE,
  DEMO_POLICY,
  DEMO_SUBJECT_LABEL,
  buildVettingDeps,
  canRunLive,
  loadAgentConfig,
  runVetting,
} from '@obsign/agent'
import type { AppContext } from '../context.js'

interface StreamQuery {
  mode?: string
  secret?: string
}

export function registerSentinelRoutes(app: FastifyInstance, ctx: AppContext): void {
  const config = loadAgentConfig()

  app.get<{ Querystring: StreamQuery }>('/api/v1/sentinel/stream', async (request, reply) => {
    const wantLive = request.query.mode === 'live'
    const secret =
      (request.headers['x-sentinel-secret'] as string | undefined) ?? request.query.secret

    if (wantLive) {
      if (!config.runSecret || secret !== config.runSecret) {
        return reply.code(403).send({ error: 'live sentinel runs require a valid secret' })
      }
      if (!canRunLive(config)) {
        return reply
          .code(409)
          .send({ error: 'agent wallet, rpc, or contract addresses are not configured' })
      }
    }
    const mode: 'live' | 'simulation' = wantLive ? 'live' : 'simulation'

    // Take over the socket; we write raw SSE frames ourselves.
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'access-control-allow-origin': ctx.config.frontendOrigin,
    })

    let closed = false
    request.raw.on('close', () => {
      closed = true
    })
    const send = (payload: unknown): void => {
      if (!closed && !raw.writableEnded) raw.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    const deps = buildVettingDeps(config, {
      policy: DEMO_POLICY,
      subject: { credential: DEMO_CREDENTIAL, evidence: DEMO_EVIDENCE },
      offline: DEMO_OFFLINE,
      mode,
    })

    try {
      const run = runVetting({ subject: DEMO_SUBJECT_LABEL, claim: DEMO_CLAIM }, deps)
      for await (const step of run) {
        if (closed) break
        send(step)
      }
    } catch (err) {
      app.log.warn({ err }, 'sentinel run failed')
      send({
        id: 'error',
        kind: 'action',
        title: 'Run error',
        detail: err instanceof Error ? err.message : String(err),
      })
    } finally {
      if (!raw.writableEnded) raw.end()
    }
  })
}

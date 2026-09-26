// Sentinel trace route (Phase 6). Streams an autonomous vetting run as SSE for
// the web console (apps/web/src/lib/useEventStream.ts expects `data: <SentinelStep>`
// frames separated by blank lines).
//
// SECURITY: the default run is `simulation` — it uses the SDK offline verifier,
// moves no funds, and broadcasts no transaction, so it is safe to expose
// unauthenticated for the public demo. A `live` run spends testnet USDC (x402)
// and writes on-chain, so it is authorized by EITHER the shared SENTINEL_RUN_SECRET
// (falls back to CRON_SECRET, for cron/server callers) OR a valid SIWE session
// (Authorization: Bearer <jwt>, for a signed-in browser). It also requires a
// fully-configured agent wallet. An optional SENTINEL_ADMIN_ADDRESSES allowlist
// restricts which session addresses may trigger a live (funds-spending) run.

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
  type Policy,
} from '@obsign/agent'
import type { AppContext } from '../context.js'
import { requireSession } from '../auth.js'

/** Lowercased allowlist of addresses permitted to trigger live runs (empty = any signed-in session). */
const LIVE_ADMIN_ADDRESSES = (process.env.SENTINEL_ADMIN_ADDRESSES ?? '')
  .split(',')
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean)

interface StreamQuery {
  mode?: string
  secret?: string
  /** Vet a specific stored credential (live integration) instead of the demo subject. */
  credentialId?: string
}

/** Human-readable claim label from a stored credential's claim block. */
function claimLabel(credential: unknown): string {
  const claim =
    (credential as { claim?: { type?: string; context?: string } } | null)?.claim ?? {}
  if (claim.type && claim.context) return `${claim.type} — ${claim.context}`
  return claim.type ?? claim.context ?? 'credential'
}

/**
 * Build a per-credential vetting policy from the credential under test, so the
 * structural checks (claim type/context, issuer, evidence kind) match the real
 * credential by construction and the grant/deny decision hinges on the genuine
 * signals: deterministic validity and non-revocation. Without this the run would
 * be evaluated against the unrelated demo policy and always deny a real subject.
 */
function policyForCredential(credential: unknown, evidence: unknown): Policy {
  const cred =
    credential && typeof credential === 'object' ? (credential as Record<string, unknown>) : {}
  const claim =
    cred.claim && typeof cred.claim === 'object'
      ? (cred.claim as { type?: string; context?: string })
      : {}
  const first = Array.isArray(evidence) ? evidence[0] : evidence
  const evKind =
    first && typeof first === 'object' && typeof (first as { kind?: unknown }).kind === 'string'
      ? (first as { kind: string }).kind
      : 'artifact-hash'
  return {
    id: `credential:${claim.type ?? 'generic'}:${claim.context ?? 'default'}`,
    version: 1,
    claimType: claim.type ?? '',
    context: claim.context ?? '',
    requiredEvidenceKind: evKind as Policy['requiredEvidenceKind'],
    mustBeAnchored: false,
    mustNotBeRevoked: true,
    validityRequired: true,
    ...(typeof cred.issuer === 'string' ? { requiredIssuer: cred.issuer } : {}),
  }
}

export function registerSentinelRoutes(app: FastifyInstance, ctx: AppContext): void {
  const config = loadAgentConfig()

  app.get<{ Querystring: StreamQuery }>('/api/v1/sentinel/stream', async (request, reply) => {
    const wantLive = request.query.mode === 'live'
    const secret =
      (request.headers['x-sentinel-secret'] as string | undefined) ?? request.query.secret

    if (wantLive) {
      // Authorize via shared secret (cron/server) OR a valid SIWE session (browser).
      const hasValidSecret = Boolean(config.runSecret) && secret === config.runSecret
      if (!hasValidSecret) {
        const address = await requireSession(ctx, request, reply)
        if (!address) return // requireSession already sent a 401
        if (LIVE_ADMIN_ADDRESSES.length > 0 && !LIVE_ADMIN_ADDRESSES.includes(address.toLowerCase())) {
          return reply
            .code(403)
            .send({ error: 'this address is not permitted to trigger live sentinel runs' })
        }
      }
      if (!canRunLive(config)) {
        return reply
          .code(409)
          .send({ error: 'agent wallet, rpc, or contract addresses are not configured' })
      }
    }
    const mode: 'live' | 'simulation' = wantLive ? 'live' : 'simulation'

    // Resolve the subject to vet. Default is the bundled demo subject (public
    // showcase); when a credentialId is supplied we vet that real, stored
    // credential end to end — the live integration.
    let subject: { credential: unknown; evidence: unknown } = {
      credential: DEMO_CREDENTIAL,
      evidence: DEMO_EVIDENCE,
    }
    let subjectLabel = DEMO_SUBJECT_LABEL
    let claim = DEMO_CLAIM
    let offline = DEMO_OFFLINE
    let policy: Policy = DEMO_POLICY
    const credentialId = request.query.credentialId
    if (credentialId) {
      const cred = await ctx.repos.credentials.get(credentialId)
      if (!cred) {
        return reply.code(404).send({ error: `credential ${credentialId} not found` })
      }
      subject = { credential: cred.credential, evidence: cred.evidence }
      subjectLabel = cred.subject ?? credentialId
      claim = claimLabel(cred.credential)
      // Evaluate the real credential against a policy derived from itself, so the
      // verdict reflects genuine validity/revocation rather than the demo policy.
      policy = policyForCredential(cred.credential, cred.evidence)
      // A real credential has no pinned demo artifacts; simulation just uses now.
      offline = { now: new Date().toISOString() }
    }

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
      policy,
      subject,
      offline,
      mode,
    })

    try {
      const run = runVetting({ subject: subjectLabel, claim }, deps)
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

// POST /api/v1/verify (FR-4.1). Wrapped by the x402 gate (FR-4.2): an unpaid
// request gets a 402 challenge; a paid request runs the pure verifier and returns
// the versioned Receipt. The verdict/receiptId come only from @obsign/core via
// the shared `runVerify` path (identical to the CLI and to MCP `obsign_verify`).
// The `paid` flag is metadata appended outside the hashed inputs (INV-3).

import type { FastifyInstance } from 'fastify'
import type { Receipt } from '@obsign/core'
import type { AppContext } from '../context.js'
import type { X402Gate } from '../x402.js'
import { runVerify, type VerifyDeps, type VerifyInput } from '../verify-service.js'

interface VerifyBody {
  credential?: unknown
  evidence?: unknown
  now?: unknown
}

const VERIFY_RESOURCE = '/api/v1/verify'

/** Persist the verdict snapshot to the cache (INV-4). Best-effort, re-derivable. */
async function cacheReceipt(ctx: AppContext, receipt: Receipt, credential: unknown): Promise<void> {
  const c = (credential ?? {}) as Record<string, unknown>
  const credentialId = typeof c.credentialId === 'string' ? c.credentialId : receipt.receiptId
  await ctx.repos.receipts.upsert({
    receiptId: receipt.receiptId,
    credentialId,
    result: receipt.result,
    reasonCode: receipt.reasonCode,
    credentialHash: receipt.credentialHash,
    evidenceHash: receipt.evidenceHash,
    issuer: receipt.issuer,
    subject: receipt.subject,
    verifiedAt: receipt.verifiedAt,
    verifier: receipt.verifier,
  })
}

export function registerVerifyRoutes(
  app: FastifyInstance,
  ctx: AppContext,
  gate: X402Gate,
  verifyDeps: VerifyDeps,
): void {
  app.post<{ Body: VerifyBody }>(VERIFY_RESOURCE, async (request, reply) => {
    const body = request.body ?? {}
    const { credential, evidence } = body
    if (!credential || typeof credential !== 'object') {
      return reply.code(400).send({ error: 'credential is required' })
    }

    const outcome = await gate.settle(request.headers, VERIFY_RESOURCE)
    if (!outcome.paid) {
      // x402 v2: advertise the requirements in the PAYMENT-REQUIRED header too.
      reply.header('PAYMENT-REQUIRED', outcome.challengeHeader)
      return reply.code(outcome.status).send(outcome.challenge)
    }

    const input: VerifyInput = { credential, evidence: evidence ?? [] }
    if (typeof body.now === 'string') input.now = body.now

    const receipt = await runVerify(verifyDeps, input)
    // Cache is a convenience; a failure here must never fail the verification.
    await cacheReceipt(ctx, receipt, credential).catch(() => {})

    // x402 v2: echo the settlement result in the PAYMENT-RESPONSE header.
    reply.header('PAYMENT-RESPONSE', outcome.settlementHeader)
    return reply.code(200).send({ ...receipt, paid: true })
  })
}

// Issuance routes (P3-3). The issuer's wallet has already submitted the anchor /
// revoke tx on-chain; these routes persist the signed credential + evidence and
// the submitted txHash, then enqueue the confirm/index job. No server keys.

import type { FastifyInstance } from 'fastify'
import { CredentialValidationError, EvidenceTooLargeError } from '@obsign/platform'
import type { AppContext } from '../context.js'
import { requireSession } from '../auth.js'

interface CreateBody {
  credential?: Record<string, unknown>
  evidence?: unknown
  issuerSignature?: string
  txHash?: string
}

interface RevokeBody {
  txHash?: string
}

export function registerCredentialRoutes(app: FastifyInstance, ctx: AppContext): void {
  // Upload artifact-hash evidence bytes → GridFS (size-capped, SEC-5).
  app.post('/api/v1/evidence', async (request, reply) => {
    const address = await requireSession(ctx, request, reply)
    if (!address) return

    const file = await request.file()
    if (!file) {
      return reply.code(400).send({ error: 'multipart file field is required' })
    }
    const buf = await file.toBuffer()
    try {
      const meta: { contentType?: string; filename?: string } = {}
      if (file.mimetype) meta.contentType = file.mimetype
      if (file.filename) meta.filename = file.filename
      const result = await ctx.evidence.put(new Uint8Array(buf), meta)
      return result
    } catch (err) {
      if (err instanceof EvidenceTooLargeError) {
        return reply.code(413).send({ error: err.message })
      }
      throw err
    }
  })

  // Issue: persist the signed credential + anchor txHash, enqueue confirmAnchor.
  app.post<{ Body: CreateBody }>('/api/v1/credentials', async (request, reply) => {
    const address = await requireSession(ctx, request, reply)
    if (!address) return

    const { credential, evidence, issuerSignature, txHash } = request.body ?? {}
    if (!credential || typeof issuerSignature !== 'string' || typeof txHash !== 'string') {
      return reply.code(400).send({ error: 'credential, issuerSignature, and txHash are required' })
    }
    const issuer = typeof credential.issuer === 'string' ? credential.issuer.toLowerCase() : ''
    if (issuer !== address) {
      return reply.code(403).send({ error: 'session address must equal credential.issuer' })
    }

    try {
      const result = await ctx.credentials.issue({
        credential,
        evidence: evidence ?? [],
        issuerSignature,
        anchorTxHash: txHash,
      })
      return reply.code(201).send({ ...result, paid: false })
    } catch (err) {
      if (err instanceof CredentialValidationError) {
        return reply.code(400).send({ error: err.message })
      }
      throw err
    }
  })

  // Revoke: record the issuer's revoke tx and enqueue reflectRevocation (P2-3).
  app.post<{ Params: { id: string }; Body: RevokeBody }>(
    '/api/v1/credentials/:id/revoke',
    async (request, reply) => {
      const address = await requireSession(ctx, request, reply)
      if (!address) return

      const { txHash } = request.body ?? {}
      if (typeof txHash !== 'string') {
        return reply.code(400).send({ error: 'txHash is required' })
      }
      try {
        const result = await ctx.credentials.revoke(request.params.id, address, txHash)
        return result
      } catch (err) {
        if (err instanceof CredentialValidationError) {
          return reply.code(400).send({ error: err.message })
        }
        throw err
      }
    },
  )
}

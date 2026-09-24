// Read routes. Served from the cache (INV-4); on a miss for a receipt, the row
// is re-derivable, so a caller can always recompute from the credential offline.

import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'

export function registerReadRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get<{ Params: { id: string } }>('/api/v1/credentials/:id', async (request, reply) => {
    const cred = await ctx.repos.credentials.get(request.params.id)
    if (!cred) return reply.code(404).send({ error: 'credential not found' })
    const anchor = await ctx.repos.anchors.get(cred.credentialId)
    const revocation = await ctx.repos.revocations.get(cred.credentialId)
    return {
      credentialId: cred.credentialId,
      issuer: cred.issuer,
      subject: cred.subject,
      credential: cred.credential,
      evidence: cred.evidence,
      credentialHash: cred.credentialHash,
      receiptId: cred.receiptId,
      status: cred.status,
      anchorTxHash: cred.anchorTxHash,
      anchor,
      revocation,
    }
  })

  app.get<{ Params: { receiptId: string } }>(
    '/api/v1/receipts/:receiptId',
    async (request, reply) => {
      const receipt = await ctx.repos.receipts.get(request.params.receiptId)
      if (!receipt) return reply.code(404).send({ error: 'receipt not found' })
      return receipt
    },
  )

  app.get<{ Params: { address: string } }>(
    '/api/v1/issuers/:address/credentials',
    async (request) => {
      const docs = await ctx.repos.credentials.listByIssuer(request.params.address)
      return docs.map((doc) => {
        const claim = (doc.credential?.claim ?? {}) as { type?: string; context?: string }
        const claimLabel =
          claim.type && claim.context
            ? `${claim.type} — ${claim.context}`
            : (claim.type ?? claim.context ?? 'credential')
        const issuedAt =
          typeof doc.credential?.issuedAt === 'string' ? doc.credential.issuedAt : doc.createdAt
        return {
          id: doc.credentialId,
          claim: claimLabel,
          issuer: doc.issuer,
          status: doc.status,
          anchorTx: doc.anchorTxHash ?? '—',
          issuedAt,
        }
      })
    },
  )

  app.get<{ Params: { address: string } }>('/api/v1/issuers/:address', async (request, reply) => {
    const issuer = await ctx.repos.issuers.get(request.params.address)
    if (!issuer) return reply.code(404).send({ error: 'issuer not found' })
    return issuer
  })
}

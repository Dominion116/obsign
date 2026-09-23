// SIWE auth routes (P3-2 / SEC-2): mint a nonce, then verify a wallet-signed
// EIP-4361 message and return a session JWT bound to the recovered address.

import type { FastifyInstance } from 'fastify'
import type { AppContext } from '../context.js'

interface VerifyBody {
  message?: string
  signature?: string
}

export function registerSiweRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/siwe/nonce', async () => {
    const nonce = await ctx.siwe.issueNonce()
    return { nonce }
  })

  app.post<{ Body: VerifyBody }>('/api/v1/siwe/verify', async (request, reply) => {
    const { message, signature } = request.body ?? {}
    if (typeof message !== 'string' || typeof signature !== 'string') {
      return reply.code(400).send({ error: 'message and signature are required' })
    }
    try {
      const session = await ctx.siwe.verify({ message, signature })
      const token = await ctx.siwe.mintSession(session.address)
      await ctx.repos.issuers.touchLogin(session.address)
      await ctx.repos.audit.append({ kind: 'siwe_login', address: session.address })
      return { token, address: session.address }
    } catch {
      return reply.code(401).send({ error: 'SIWE verification failed' })
    }
  })
}

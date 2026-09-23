// SIWE session gate (SEC-2) and CRON_SECRET gate (SEC-4). Both are plain helpers
// that a route calls at the top of its handler — no Fastify decorators, so the
// types stay simple and the checks are explicit at each call site.

import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AppContext } from './context.js'

/**
 * Require a valid SIWE session. Returns the bound issuer address, or sends 401
 * and returns null (the caller must `return` immediately on null).
 */
export async function requireSession(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<string | null> {
  const header = request.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'Missing bearer session token' })
    return null
  }
  const token = header.slice('Bearer '.length)
  try {
    const session = await ctx.siwe.verifySession(token)
    return session.address
  } catch {
    await reply.code(401).send({ error: 'Invalid or expired session' })
    return null
  }
}

/**
 * Require the shared CRON_SECRET on an internal route. The secret may arrive via
 * `Authorization: Bearer <secret>` or the `x-cron-secret` header. Sends 401 and
 * returns false on mismatch.
 */
export async function requireCronSecret(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const header = request.headers.authorization
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
  const provided = bearer ?? (request.headers['x-cron-secret'] as string | undefined)
  if (!provided || provided !== ctx.config.cronSecret) {
    await reply.code(401).send({ error: 'Invalid cron secret' })
    return false
  }
  return true
}

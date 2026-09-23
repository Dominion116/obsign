// Internal routes (SEC-4), guarded by CRON_SECRET. cron-jobs.org calls the drain
// route on a schedule; the webhook route triggers an immediate drain right after
// issuance/revocation so confirmations are picked up promptly.

import type { FastifyInstance } from 'fastify'
import { reapExpired, runDrain } from '@obsign/worker'
import type { AppContext } from '../context.js'
import { requireCronSecret } from '../auth.js'

interface DrainQuery {
  type?: string
  limit?: string
}

const DRAINABLE = new Set(['confirmAnchor', 'reflectRevocation'])
const DEFAULT_LIMIT = 25

export function registerInternalRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post<{ Querystring: DrainQuery }>('/internal/cron/drain', async (request, reply) => {
    if (!(await requireCronSecret(ctx, request, reply))) return

    const limit = Math.min(
      Math.max(Number.parseInt(request.query.limit ?? '', 10) || DEFAULT_LIMIT, 1),
      100,
    )
    const type = request.query.type

    // reapExpired first so crash-orphaned leases rejoin the runnable set.
    const reaped = await reapExpired(ctx.worker)

    const results: Record<string, number> = {}
    const types = type ? [type] : [...DRAINABLE]
    for (const t of types) {
      if (t === 'reapExpired') continue
      if (!DRAINABLE.has(t)) {
        return reply.code(400).send({ error: `unknown drain type: ${t}` })
      }
      results[t] = await runDrain(ctx.worker, t, limit)
    }
    return { reaped, drained: results }
  })

  app.post('/internal/webhook/drain', async (request, reply) => {
    if (!(await requireCronSecret(ctx, request, reply))) return
    const results: Record<string, number> = {}
    for (const t of DRAINABLE) {
      results[t] = await runDrain(ctx.worker, t, DEFAULT_LIMIT)
    }
    return { drained: results }
  })
}

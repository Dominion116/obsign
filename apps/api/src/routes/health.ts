// Health endpoint (OBS-3): DB ping, RPC reachability, and queue depth. Never
// throws — a degraded dependency is reported, not fatal.

import type { FastifyInstance } from 'fastify'
import type { Db } from 'mongodb'
import type { AppContext } from '../context.js'

export function registerHealthRoutes(app: FastifyInstance, ctx: AppContext, db: Db): void {
  app.get('/api/v1/health', async () => {
    const checks: Record<string, { status: 'operational' | 'down'; detail?: string }> = {}

    try {
      await db.command({ ping: 1 })
      checks.database = { status: 'operational' }
    } catch (err) {
      checks.database = { status: 'down', detail: err instanceof Error ? err.message : String(err) }
    }

    try {
      const head = await ctx.indexer.head()
      checks.rpc = { status: 'operational', detail: `head=${head.toString()}` }
    } catch (err) {
      checks.rpc = { status: 'down', detail: err instanceof Error ? err.message : String(err) }
    }

    let queueDepth = -1
    try {
      queueDepth = await ctx.queue.depth()
    } catch {
      // leave as -1
    }

    const ok = Object.values(checks).every((c) => c.status === 'operational')
    return { status: ok ? 'operational' : 'degraded', queueDepth, checks }
  })
}

// Render entrypoint. Loads + validates config, connects Mongo, ensures indexes,
// builds the Fastify app, and listens on the Render-provided PORT. RULE-1: this
// is never run locally — Render (or CI) executes it.

import { ensureIndexes, getMongoClient, loadConfig } from '@obsign/platform'
import { reapExpired, runDrain } from '@obsign/worker'
import { buildApp } from './app.js'

const DRAIN_TYPES = ['confirmAnchor', 'reflectRevocation'] as const

async function main(): Promise<void> {
  const config = loadConfig()
  const client = await getMongoClient(config.mongoUri)
  const db = client.db()
  await ensureIndexes(db)

  const { app, ctx } = await buildApp(db, config)

  await app.listen({ host: '0.0.0.0', port: config.port })
  app.log.info(`Obsign API listening on :${config.port}`)

  // Optional in-process queue drain. By default the queue is drained by an
  // external scheduler hitting POST /internal/cron/drain (see render.yaml). When
  // no external cron is configured, set SELF_DRAIN_MS to have the service drain
  // its own confirm/revocation jobs periodically so anchors move pending →
  // anchored without extra infrastructure. Off by default.
  const selfDrainMs = Number.parseInt(process.env.SELF_DRAIN_MS ?? '', 10)
  if (Number.isFinite(selfDrainMs) && selfDrainMs > 0) {
    const tick = async (): Promise<void> => {
      try {
        await reapExpired(ctx.worker)
        for (const type of DRAIN_TYPES) await runDrain(ctx.worker, type, 25)
      } catch (err) {
        app.log.warn({ err }, 'self-drain tick failed')
      }
    }
    const timer = setInterval(() => void tick(), selfDrainMs)
    timer.unref?.()
    app.log.info(`self-drain enabled every ${selfDrainMs}ms`)
  }
}

main().catch((err) => {
  console.error('Fatal: failed to start Obsign API', err)
  process.exit(1)
})

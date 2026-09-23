// Render entrypoint. Loads + validates config, connects Mongo, ensures indexes,
// builds the Fastify app, and listens on the Render-provided PORT. RULE-1: this
// is never run locally — Render (or CI) executes it.

import { ensureIndexes, getMongoClient, loadConfig } from '@obsign/platform'
import { buildApp } from './app.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const client = await getMongoClient(config.mongoUri)
  const db = client.db()
  await ensureIndexes(db)

  const { app } = await buildApp(db, config)

  await app.listen({ host: '0.0.0.0', port: config.port })
  app.log.info(`Obsign API listening on :${config.port}`)
}

main().catch((err) => {
  console.error('Fatal: failed to start Obsign API', err)
  process.exit(1)
})

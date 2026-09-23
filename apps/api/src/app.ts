// The Fastify app factory. `buildApp` takes a live Db + config, registers CORS,
// multipart, and every route group, and returns a ready (un-listened) instance
// so tests can `inject` without opening a socket. `server.ts` owns bootstrap.

import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import type { Db } from 'mongodb'
import type { PlatformConfig } from '@obsign/platform'
import { buildContext, type AppContext } from './context.js'
import { registerSiweRoutes } from './routes/siwe.js'
import { registerCredentialRoutes } from './routes/credentials.js'
import { registerReadRoutes } from './routes/reads.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerInternalRoutes } from './routes/internal.js'

export interface BuiltApp {
  app: FastifyInstance
  ctx: AppContext
}

export async function buildApp(db: Db, config: PlatformConfig): Promise<BuiltApp> {
  const app = Fastify({ logger: true, bodyLimit: config.evidenceMaxBytes + 1_048_576 })
  const ctx = buildContext(db, config)

  await app.register(cors, { origin: config.frontendOrigin, credentials: true })
  await app.register(multipart, { limits: { fileSize: config.evidenceMaxBytes } })

  registerHealthRoutes(app, ctx, db)
  registerSiweRoutes(app, ctx)
  registerCredentialRoutes(app, ctx)
  registerReadRoutes(app, ctx)
  registerInternalRoutes(app, ctx)

  return { app, ctx }
}

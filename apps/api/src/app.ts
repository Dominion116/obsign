// The Fastify app factory. `buildApp` takes a live Db + config, registers CORS,
// multipart, and every route group, and returns a ready (un-listened) instance
// so tests can `inject` without opening a socket. `server.ts` owns bootstrap.
//
// Phase 4: the verify + MCP routes share one x402 gate and one core verify path.
// `overrides` lets tests inject a stub facilitator and pinned (fixture) verify
// deps so the 402/replay/equivalence suites need neither a live chain nor a live
// facilitator.

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
import { registerVerifyRoutes } from './routes/verify.js'
import { registerMcpRoutes } from './routes/mcp.js'
import { X402Gate, createHttpFacilitator, type FacilitatorClient } from './x402.js'
import { defaultVerifyDeps, type VerifyDeps } from './verify-service.js'

export interface BuiltApp {
  app: FastifyInstance
  ctx: AppContext
}

/** Test/embedding seams: inject a stub facilitator and/or pinned verify deps. */
export interface AppOverrides {
  facilitator?: FacilitatorClient
  verifyDeps?: VerifyDeps
}

export async function buildApp(
  db: Db,
  config: PlatformConfig,
  overrides: AppOverrides = {},
): Promise<BuiltApp> {
  const app = Fastify({ logger: true, bodyLimit: config.evidenceMaxBytes + 1_048_576 })
  const ctx = buildContext(db, config)

  await app.register(cors, { origin: config.frontendOrigin, credentials: true })
  await app.register(multipart, { limits: { fileSize: config.evidenceMaxBytes } })

  const facilitator = overrides.facilitator ?? createHttpFacilitator(config.x402FacilitatorUrl)
  const gate = new X402Gate({
    payeeAddress: config.x402PayeeAddress,
    amount: config.x402PriceUsdc,
    network: config.x402Network,
    asset: config.x402AssetAddress,
    assetName: config.x402AssetName,
    assetVersion: config.x402AssetVersion,
    facilitator,
    proofs: ctx.payments,
    logger: { warn: (obj, msg) => app.log.warn(obj as Record<string, unknown>, msg) },
  })
  const verifyDeps = overrides.verifyDeps ?? defaultVerifyDeps(ctx)

  registerHealthRoutes(app, ctx, db)
  registerSiweRoutes(app, ctx)
  registerCredentialRoutes(app, ctx)
  registerReadRoutes(app, ctx)
  registerInternalRoutes(app, ctx)
  registerVerifyRoutes(app, ctx, gate, verifyDeps)
  registerMcpRoutes(app, ctx, gate, verifyDeps)

  return { app, ctx }
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, type Db } from 'mongodb'
import type { FastifyInstance } from 'fastify'
import { ensureIndexes, type PlatformConfig } from '@obsign/platform'
import { buildApp } from '../src/app.js'

const SKIP = process.platform === 'win32'

const CONFIG: PlatformConfig = {
  mongoUri: '',
  rpcUrl: 'http://127.0.0.1:1',
  chainId: 84532,
  evidenceMaxBytes: 5_242_880,
  anchorMinConfirmations: 12,
  sessionJwtSecret: 'test-secret-at-least-32-chars-long!!',
  frontendOrigin: 'http://localhost:5173',
  cronSecret: 'top-secret',
  port: 8080,
  anchorAddress: '0x' + '11'.repeat(20),
  revocationAddress: '0x' + '22'.repeat(20),
  issuerRegistryAddress: '0x' + '33'.repeat(20),
  policyRegistryAddress: '0x' + '44'.repeat(20),
  x402PayeeAddress: '0x' + '55'.repeat(20),
  x402PriceUsdc: '0.01',
  x402FacilitatorUrl: 'http://127.0.0.1:1',
}

describe.skipIf(SKIP)('Obsign API', () => {
  let server: MongoMemoryServer
  let client: MongoClient
  let db: Db
  let app: FastifyInstance

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    client = await MongoClient.connect(server.getUri())
    db = client.db('obsign_api_test')
    await ensureIndexes(db)
    ;({ app } = await buildApp(db, CONFIG))
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await client.close()
    await server.stop()
  })

  it('GET /api/v1/health reports DB operational and a queue depth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.checks.database.status).toBe('operational')
    expect(typeof body.queueDepth).toBe('number')
  })

  it('GET /api/v1/siwe/nonce mints a nonce', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/siwe/nonce' })
    expect(res.statusCode).toBe(200)
    expect(res.json().nonce).toHaveLength(17)
  })

  it('POST /api/v1/credentials without a session is 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/credentials',
      payload: { credential: {}, issuerSignature: '0x', txHash: '0x' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /internal/cron/drain requires the CRON_SECRET (SEC-4)', async () => {
    const denied = await app.inject({ method: 'POST', url: '/internal/cron/drain' })
    expect(denied.statusCode).toBe(401)

    const ok = await app.inject({
      method: 'POST',
      url: '/internal/cron/drain',
      headers: { 'x-cron-secret': 'top-secret' },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toHaveProperty('drained')
  })
})

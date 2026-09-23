// Live x402 loop (secret-gated, mirrors the phase3-integration pattern). Runs the
// real 402 → verify → settle → receipt loop against a real x402 facilitator using
// a pre-generated payment header supplied by CI secrets. Self-skips when the
// secrets (or a mongod, on win32) are absent, so ordinary CI stays green.
//
// Required env (CI secrets):
//   X402_FACILITATOR_URL   — a reachable x402 facilitator (verify/settle)
//   X402_PAYEE_ADDRESS     — the payee the payment authorizes
//   X402_PRICE_USDC        — the advertised price
//   X402_PAYMENT_HEADER    — a base64 X-PAYMENT proof valid for the above
//
// The verdict is not asserted (the pinned fixture block will not match live Base
// Sepolia); this test proves the economic loop end-to-end: a paid request settles
// through the real facilitator and returns a well-formed receipt.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, type Db } from 'mongodb'
import type { FastifyInstance } from 'fastify'
import { type PlatformConfig, ensureIndexes } from '@obsign/platform'
import { loadVectors } from '@obsign/spec/vectors'
import { prepareVector } from '@obsign/spec/prepare'
import { buildApp } from '../src/app.js'
import { fixtureVerifyDeps } from '../src/verify-service.js'

const facilitatorUrl = process.env.X402_FACILITATOR_URL
const paymentHeader = process.env.X402_PAYMENT_HEADER
const payee = process.env.X402_PAYEE_ADDRESS
const price = process.env.X402_PRICE_USDC

const enabled =
  process.platform !== 'win32' && Boolean(facilitatorUrl && paymentHeader && payee && price)

describe.skipIf(!enabled)('Phase 4 live x402 loop (secret-gated)', () => {
  let server: MongoMemoryServer
  let client: MongoClient
  let db: Db
  let app: FastifyInstance
  let credential: unknown
  let evidence: unknown

  beforeAll(async () => {
    const config: PlatformConfig = {
      mongoUri: '',
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? 'http://127.0.0.1:1',
      chainId: 84532,
      evidenceMaxBytes: 5_242_880,
      anchorMinConfirmations: 12,
      sessionJwtSecret: 'integration-secret-at-least-32-chars!!',
      frontendOrigin: 'http://localhost:5173',
      cronSecret: 'top-secret',
      port: 8080,
      anchorAddress: '0x' + '11'.repeat(20),
      revocationAddress: '0x' + '22'.repeat(20),
      issuerRegistryAddress: '0x' + '33'.repeat(20),
      policyRegistryAddress: '0x' + '44'.repeat(20),
      x402PayeeAddress: payee as string,
      x402PriceUsdc: price as string,
      x402FacilitatorUrl: facilitatorUrl as string,
    }

    const found = loadVectors().find((v) => v.file === 'onchain-valid-01.json')
    if (!found) throw new Error('onchain-valid-01.json vector missing')
    const prepared = prepareVector(found.vector)
    credential = prepared.credential
    evidence = prepared.evidence

    server = await MongoMemoryServer.create()
    client = await MongoClient.connect(server.getUri())
    db = client.db('obsign_phase4_live')
    await ensureIndexes(db)
    // Real HTTP facilitator (default); pinned fixture chain so verdict is stable.
    ;({ app } = await buildApp(db, config, { verifyDeps: fixtureVerifyDeps(prepared.ctx) }))
    await app.ready()
  })

  afterAll(async () => {
    await app?.close()
    await client?.close()
    await server?.stop()
  })

  it('unpaid request returns a 402 challenge with the live payee', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      payload: { credential, evidence },
    })
    expect(res.statusCode).toBe(402)
    expect(res.json().accepts[0].payTo).toBe(payee)
  })

  it('paid request settles through the real facilitator and returns a receipt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-payment': paymentHeader as string },
      payload: { credential, evidence },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.paid).toBe(true)
    expect(body.receiptId).toMatch(/^0x[0-9a-f]{64}$/)
  })
})

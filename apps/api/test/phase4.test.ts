// Phase 4 integration: the full x402 loop on the verify endpoint + MCP.
// Mongo-backed, so it self-skips on the Windows CI leg (mongodb-memory-server is
// flaky there) and runs on the Linux leg. No live chain or facilitator: the
// chain is a pinned fixture and the facilitator is a stub, so this exercises the
// gate/replay/equivalence logic deterministically. The live Base Sepolia loop is
// covered by the secret-gated phase4-integration workflow.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, type Db } from 'mongodb'
import type { FastifyInstance } from 'fastify'
import { buildReceipt, type VerificationContext } from '@obsign/core'
import { ensureIndexes, type PlatformConfig } from '@obsign/platform'
import { loadVectors } from '@obsign/spec/vectors'
import { prepareVector } from '@obsign/spec/prepare'
import { buildApp } from '../src/app.js'
import { fixtureVerifyDeps } from '../src/verify-service.js'
import type { FacilitatorClient } from '../src/x402.js'

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
  x402PriceUsdc: '10000',
  x402FacilitatorUrl: 'http://127.0.0.1:1',
  x402Network: 'eip155:84532',
  x402AssetAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  x402AssetName: 'USDC',
  x402AssetVersion: '2',
}

// A facilitator that always accepts + settles — the on-chain economics are not
// under test here; the gate/replay/equivalence logic is.
const okFacilitator: FacilitatorClient = {
  verify: async () => ({ isValid: true, payer: '0x' + 'ab'.repeat(20) }),
  settle: async () => ({ success: true, txHash: '0x' + 'cd'.repeat(32) }),
}

/** Build a base64 PAYMENT-SIGNATURE header (x402 v2) whose replay key is `sig`. */
function paymentHeader(sig: string): string {
  const payment = {
    x402Version: 1,
    scheme: 'exact',
    network: 'base-sepolia',
    payload: { signature: sig },
  }
  return Buffer.from(JSON.stringify(payment), 'utf8').toString('base64')
}

describe.skipIf(SKIP)('Phase 4 — x402 verify + MCP', () => {
  let server: MongoMemoryServer
  let client: MongoClient
  let db: Db
  let app: FastifyInstance

  let credential: unknown
  let evidence: unknown
  let ctx: VerificationContext
  let expectedReceiptId: string

  beforeAll(async () => {
    const found = loadVectors().find((v) => v.file === 'onchain-valid-01.json')
    if (!found) throw new Error('onchain-valid-01.json vector missing')
    const prepared = prepareVector(found.vector)
    credential = prepared.credential
    evidence = prepared.evidence
    ctx = prepared.ctx
    expectedReceiptId = buildReceipt(credential, evidence, ctx).receiptId

    server = await MongoMemoryServer.create()
    client = await MongoClient.connect(server.getUri())
    db = client.db('obsign_phase4_test')
    await ensureIndexes(db)
    ;({ app } = await buildApp(db, CONFIG, {
      facilitator: okFacilitator,
      verifyDeps: fixtureVerifyDeps(ctx),
    }))
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await client.close()
    await server.stop()
  })

  it('unpaid /verify returns a valid x402 402 challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      payload: { credential, evidence },
    })
    expect(res.statusCode).toBe(402)
    const body = res.json()
    expect(body.x402Version).toBe(1)
    expect(Array.isArray(body.accepts)).toBe(true)
    expect(body.accepts[0].payTo).toBe(CONFIG.x402PayeeAddress)
    expect(body.accepts[0].maxAmountRequired).toBe('10000')
    expect(body.accepts[0].network).toBe('base-sepolia')
    expect(body.accepts[0].asset).toBe(CONFIG.x402AssetAddress)
  })

  it('paid /verify returns a receipt whose receiptId equals the CLI/oracle', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'payment-signature': paymentHeader('0x' + '01'.repeat(65)) },
      payload: { credential, evidence },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.paid).toBe(true)
    expect(body.result).toBe('valid')
    expect(body.reasonCode).toBe('OK')
    expect(body.receiptId).toBe(expectedReceiptId)
  })

  it('replaying a payment proof is rejected with 402', async () => {
    const header = paymentHeader('0x' + '02'.repeat(65))
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'payment-signature': header },
      payload: { credential, evidence },
    })
    expect(first.statusCode).toBe(200)

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'payment-signature': header },
      payload: { credential, evidence },
    })
    expect(replay.statusCode).toBe(402)
    expect(replay.json().error).toContain('already used')
  })

  it('MCP tools/list advertises the four Obsign tools', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mcp',
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    expect(res.statusCode).toBe(200)
    const names = res.json().result.tools.map((t: { name: string }) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'obsign_verify',
        'obsign_issue',
        'obsign_get_receipt',
        'obsign_get_issuer',
      ]),
    )
  })

  it('MCP obsign_verify verdict == REST /verify verdict', async () => {
    // REST with one proof…
    const rest = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'payment-signature': paymentHeader('0x' + '03'.repeat(65)) },
      payload: { credential, evidence },
    })
    expect(rest.statusCode).toBe(200)

    // …MCP with a different proof (a shared proof would be a replay).
    const mcp = await app.inject({
      method: 'POST',
      url: '/api/mcp',
      headers: { 'payment-signature': paymentHeader('0x' + '04'.repeat(65)) },
      payload: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'obsign_verify', arguments: { credential, evidence } },
      },
    })
    expect(mcp.statusCode).toBe(200)
    const toolResult = mcp.json().result
    expect(toolResult.isError).toBeFalsy()
    const receipt = JSON.parse(toolResult.content[0].text)

    const restBody = rest.json()
    expect(receipt.receiptId).toBe(restBody.receiptId)
    expect(receipt.result).toBe(restBody.result)
    expect(receipt.reasonCode).toBe(restBody.reasonCode)
    expect(receipt.receiptId).toBe(expectedReceiptId)
  })

  it('MCP obsign_verify unpaid returns the x402 challenge as a tool error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'obsign_verify', arguments: { credential, evidence } },
      },
    })
    expect(res.statusCode).toBe(200)
    const toolResult = res.json().result
    expect(toolResult.isError).toBe(true)
    const payload = JSON.parse(toolResult.content[0].text)
    expect(payload.x402.x402Version).toBe(1)
  })

  it('GET /api/v1/health reports service, DB, and queue status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.checks.database.status).toBe('operational')
    expect(typeof body.queueDepth).toBe('number')
  })
})

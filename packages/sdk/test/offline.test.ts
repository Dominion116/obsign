// SDK unit tests: offline verification is deterministic and needs no network,
// and the REST client surfaces the x402 challenge on 402. Cross-OS (no Mongo, no
// chain) so it runs on both CI legs.

import { describe, expect, it } from 'vitest'
import {
  ObsignClient,
  X402PaymentRequiredError,
  verifyOffline,
  type FetchLike,
} from '../src/index.js'

const NOW = '2026-10-01T00:00:00.000Z'

describe('verifyOffline', () => {
  it('returns a deterministic receiptId with no network', () => {
    const credential = { v: 2, credentialId: '0x' + '00'.repeat(32) }
    const evidence = { v: 1, kind: 'artifact-hash' }

    const a = verifyOffline(credential, evidence, { now: NOW })
    const b = verifyOffline(credential, evidence, { now: NOW })

    expect(a.receiptId).toMatch(/^0x[0-9a-f]{64}$/)
    expect(a.receiptId).toBe(b.receiptId)
    // v !== 1 short-circuits to UNSUPPORTED_VERSION (spec §7).
    expect(a.reasonCode).toBe('UNSUPPORTED_VERSION')
    expect(a.result).toBe('invalid')
    // The hashes describe the inputs regardless of verdict (INV-3).
    expect(a.credentialHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(a.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/)
  })
})

describe('ObsignClient', () => {
  it('throws X402PaymentRequiredError on a 402 response', async () => {
    const challenge = { x402Version: 1, error: 'payment required', accepts: [{ payTo: '0x' }] }
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 402,
      text: async () => JSON.stringify(challenge),
    })
    const client = new ObsignClient({ baseUrl: 'https://api.example', fetch: fetchImpl })

    await expect(client.verify({}, [])).rejects.toBeInstanceOf(X402PaymentRequiredError)
    await client.verify({}, []).catch((err: unknown) => {
      expect((err as X402PaymentRequiredError).challenge.x402Version).toBe(1)
    })
  })

  it('returns the receipt on a 200 response', async () => {
    const receipt = { v: 1, receiptId: '0x' + 'ab'.repeat(32), result: 'valid', reasonCode: 'OK' }
    let sentPayment: string | undefined
    const fetchImpl: FetchLike = async (_input, init) => {
      sentPayment = init?.headers?.['x-payment']
      return { ok: true, status: 200, text: async () => JSON.stringify(receipt) }
    }
    const client = new ObsignClient({ baseUrl: 'https://api.example/', fetch: fetchImpl })

    const out = (await client.verify({}, [], { payment: 'BASE64PROOF' })) as { receiptId: string }
    expect(out.receiptId).toBe(receipt.receiptId)
    expect(sentPayment).toBe('BASE64PROOF')
  })
})

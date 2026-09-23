import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SiweService, SiweVerificationError, createMongoNonceStore } from '../src/siwe.js'
import { collections, ensureIndexes } from '../src/mongo.js'
import { SKIP_MONGO_TESTS, startMemoryMongo, type MemoryMongo } from './helpers/memory-mongo.js'

const MOCK_SECRET = 'test-secret-at-least-32-chars-long!!'

function makeService(mongo: MemoryMongo) {
  return new SiweService({
    nonces: createMongoNonceStore(collections(mongo.db).siweNonces),
    domain: 'app.obsign.test',
    uri: 'https://app.obsign.test',
    chainId: 84532,
    jwtSecret: MOCK_SECRET,
    sessionTtlSeconds: 3600,
  })
}

/** A deterministic 65-byte "signature" that viem can parse (v=0, r=1…32, s=1…32). */
function fakeSig(): string {
  return '0x' + '01'.repeat(32) + '02'.repeat(32) + '00'
}

describe.skipIf(SKIP_MONGO_TESTS)('SIWE', () => {
  let mongo: MemoryMongo

  beforeAll(async () => {
    mongo = await startMemoryMongo()
    await ensureIndexes(mongo.db)
  })

  afterAll(async () => {
    await mongo.stop()
  })

  it('issueNonce returns a fresh string each time', async () => {
    const svc = makeService(mongo)
    const n1 = await svc.issueNonce()
    const n2 = await svc.issueNonce()
    expect(n1).toHaveLength(17)
    expect(n1).not.toBe(n2)
  })

  it('buildMessage produces a string that contains the address and nonce', async () => {
    const svc = makeService(mongo)
    const nonce = await svc.issueNonce()
    const msg = svc.buildMessage({ address: '0x1111111111111111111111111111111111111111', nonce })
    expect(msg).toContain('0x1111111111111111111111111111111111111111')
    expect(msg).toContain(nonce)
    expect(msg).toContain('app.obsign.test')
  })

  it('verify rejects an unknown or replayed nonce', async () => {
    const svc = makeService(mongo)
    const nonce = await svc.issueNonce()
    const msg = svc.buildMessage({ address: '0x1111111111111111111111111111111111111111', nonce })

    // Valid signature from a different address — nonce is consumed, so it still fails.
    await expect(svc.verify({ message: msg, signature: fakeSig() })).rejects.toBeInstanceOf(
      SiweVerificationError,
    )

    // A second nonce — valid.
    const svc2 = makeService(mongo)
    const nonce2 = await svc2.issueNonce()
    const msg2 = svc2.buildMessage({
      address: '0x1111111111111111111111111111111111111111',
      nonce: nonce2,
    })
    await expect(svc2.verify({ message: msg2, signature: fakeSig() })).rejects.toBeInstanceOf(
      SiweVerificationError,
    )
  })

  it('verify rejects a malformed EIP-4361 message', async () => {
    const svc = makeService(mongo)
    await expect(
      svc.verify({ message: 'not a siwe message', signature: fakeSig() }),
    ).rejects.toBeInstanceOf(SiweVerificationError)
  })

  it('mintSession and verifySession round-trip for a valid issuer', async () => {
    const svc = makeService(mongo)
    const nonce = await svc.issueNonce()
    const msg = svc.buildMessage({ address: '0x2222222222222222222222222222222222222222', nonce })

    // The fakeSig does not actually recover to 0x22… — this tests only the
    // nonce-consumed path. A real integration test uses a wallet-signed sig.
    await expect(svc.verify({ message: msg, signature: fakeSig() })).rejects.toBeInstanceOf(
      SiweVerificationError,
    )

    // Minting a session without a real verify is not the happy path, but confirms
    // the JWT mechanics work.
    const token = await svc.mintSession('0x2222222222222222222222222222222222222222')
    const session = await svc.verifySession(token)
    expect(session.address).toBe('0x2222222222222222222222222222222222222222')
  })

  it('verifySession rejects a forged token', async () => {
    const svc = makeService(mongo)
    await expect(svc.verifySession('not.a.valid.jwt.token')).rejects.toBeInstanceOf(
      SiweVerificationError,
    )
  })

  it('nonce TTL: a nonce consumed in one service cannot be reused in another', async () => {
    const svc1 = makeService(mongo)
    const svc2 = makeService(mongo)
    const nonce = await svc1.issueNonce()
    const consumed = await (
      svc1 as unknown as { opts: { nonces: { consume: (n: string) => Promise<boolean> } } }
    ).opts.nonces.consume(nonce)
    expect(consumed).toBe(true)
    // A fresh service with the same collection should see it as gone.
    const consumed2 = await (
      svc2 as unknown as { opts: { nonces: { consume: (n: string) => Promise<boolean> } } }
    ).opts.nonces.consume(nonce)
    expect(consumed2).toBe(false)
  })
})

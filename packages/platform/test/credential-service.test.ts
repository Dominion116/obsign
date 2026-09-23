import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'
import { computeHashes } from '@obsign/core'
import { CredentialService, CredentialValidationError } from '../src/credential-service.js'
import { LeaseQueue } from '../src/queue.js'
import { collections, ensureIndexes } from '../src/mongo.js'
import { createRepositories } from '../src/repositories/index.js'
import { SKIP_MONGO_TESTS, startMemoryMongo, type MemoryMongo } from './helpers/memory-mongo.js'

// A fixed test key (Hardhat account #0) — TEST ONLY, never funded on mainnet.
const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const account = privateKeyToAccount(TEST_KEY)
const ISSUER = account.address.toLowerCase()

function makeService(mongo: MemoryMongo) {
  const queue = new LeaseQueue(collections(mongo.db).queue)
  return new CredentialService(createRepositories(mongo.db), queue)
}

/** Build a spec-valid credential and sign its credentialHash with the test key. */
async function signedCredential(claim: string) {
  const credentialId = ('0x' + 'ab'.repeat(32)) as Hex
  const credential = {
    v: 1,
    credentialId,
    issuer: ISSUER,
    subject: '0x2222222222222222222222222222222222222222',
    claim: { type: 'custom', context: claim, details: {} },
    evidenceRefs: [] as string[],
    issuedAt: '2026-01-01T00:00:00.000Z',
    validFrom: '2020-01-01T00:00:00.000Z',
    validUntil: '2030-01-01T00:00:00.000Z',
    nonce: '0xabcdef0123456789',
  }
  const evidence: unknown[] = []
  const { credentialHash } = computeHashes(credential, evidence)
  const signature = await account.signMessage({ message: { raw: credentialHash as Hex } })
  return { credential, evidence, credentialId, credentialHash, signature }
}

describe.skipIf(SKIP_MONGO_TESTS)('CredentialService', () => {
  let mongo: MemoryMongo

  beforeAll(async () => {
    mongo = await startMemoryMongo()
    await ensureIndexes(mongo.db)
  })

  afterAll(async () => {
    await mongo.stop()
  })

  it('issues a credential: validates, persists, and enqueues a confirm job', async () => {
    const svc = makeService(mongo)
    const { credential, evidence, credentialId, credentialHash, signature } =
      await signedCredential('Attendance')
    const res = await svc.issue({
      credential,
      evidence,
      issuerSignature: signature,
      anchorTxHash: '0x' + 'aa'.repeat(32),
    })

    expect(res.credentialId).toBe(credentialId)
    expect(res.credentialHash).toBe(credentialHash)
    expect(res.receiptId).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.status).toBe('pending')

    const cred = await collections(mongo.db).credentials.findOne({ credentialId })
    expect(cred?.status).toBe('pending')
    expect(cred?.issuer).toBe(ISSUER)

    // Idempotent enqueue: a second issue is a duplicate-key insert failure, but
    // the confirm job stays a single row.
    expect(await collections(mongo.db).queue.countDocuments({ type: 'confirmAnchor' })).toBe(1)
  })

  it('rejects a non-32-byte credentialId', async () => {
    const svc = makeService(mongo)
    const { evidence, signature, credential } = await signedCredential('X')
    const bad = { ...credential, credentialId: '0xdead' }
    await expect(
      svc.issue({
        credential: bad,
        evidence,
        issuerSignature: signature,
        anchorTxHash: '0x' + 'aa'.repeat(32),
      }),
    ).rejects.toBeInstanceOf(CredentialValidationError)
  })

  it('rejects a malformed credential shape (claim not an object)', async () => {
    const svc = makeService(mongo)
    const { evidence, signature, credential } = await signedCredential('X')
    const bad = {
      ...credential,
      credentialId: ('0x' + 'cc'.repeat(32)) as Hex,
      claim: 'not-an-object',
    }
    await expect(
      svc.issue({
        credential: bad,
        evidence,
        issuerSignature: signature,
        anchorTxHash: '0x' + 'aa'.repeat(32),
      }),
    ).rejects.toBeInstanceOf(CredentialValidationError)
  })

  it('rejects an issuerSignature that does not recover to the issuer', async () => {
    const svc = makeService(mongo)
    const { evidence, signature, credential } = await signedCredential('X')
    // Tamper the issuer to a different valid address → recovery mismatch.
    const bad = {
      ...credential,
      credentialId: ('0x' + 'dd'.repeat(32)) as Hex,
      issuer: '0x3333333333333333333333333333333333333333',
    }
    await expect(
      svc.issue({
        credential: bad,
        evidence,
        issuerSignature: signature,
        anchorTxHash: '0x' + 'aa'.repeat(32),
      }),
    ).rejects.toBeInstanceOf(CredentialValidationError)
  })

  it('only the credential issuer may revoke (P2-3)', async () => {
    const svc = makeService(mongo)
    const { credential, evidence } = await signedCredential('Revoke')
    const withId = { ...credential, credentialId: ('0x' + 'ef'.repeat(32)) as Hex }
    // Re-sign for the new credentialId.
    const { credentialHash } = computeHashes(withId, evidence)
    const sig = await account.signMessage({ message: { raw: credentialHash as Hex } })
    await svc.issue({
      credential: withId,
      evidence,
      issuerSignature: sig,
      anchorTxHash: '0x' + 'aa'.repeat(32),
    })

    await expect(
      svc.revoke(
        withId.credentialId,
        '0x9999999999999999999999999999999999999999',
        '0x' + 'bb'.repeat(32),
      ),
    ).rejects.toBeInstanceOf(CredentialValidationError)

    const res = await svc.revoke(withId.credentialId, ISSUER, '0x' + 'bb'.repeat(32))
    expect(res.credentialId).toBe(withId.credentialId)
    const cred = await collections(mongo.db).credentials.findOne({
      credentialId: withId.credentialId,
    })
    expect(cred?.status).toBe('revoked')
  })
})

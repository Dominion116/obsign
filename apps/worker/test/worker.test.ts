import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, type Db } from 'mongodb'
import { collections, ensureIndexes, LeaseQueue } from '@obsign/platform'
import { createRepositories } from '@obsign/platform'
import type { WorkerDeps } from '../src/index.js'
import { confirmAnchor, reflectRevocation, runDrain } from '../src/index.js'

const SKIP = process.platform === 'win32'

const FAKE_INDEXER = {
  confirmAnchor: vi.fn().mockResolvedValue({
    confirmed: true,
    confirmations: 12,
    blockNumber: 100,
    blockHash: '0x' + 'bb'.repeat(32),
  }),
  confirmRevocation: vi.fn().mockResolvedValue({
    confirmed: true,
    confirmations: 12,
    blockNumber: 101,
  }),
} as unknown as WorkerDeps['indexer']

describe.skipIf(SKIP)('worker handlers', () => {
  let server: MongoMemoryServer
  let client: MongoClient
  let db: Db
  let deps: WorkerDeps

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    client = await MongoClient.connect(server.getUri())
    db = client.db('obsign_worker_test')
    await ensureIndexes(db)
    deps = {
      db,
      repos: createRepositories(db),
      queue: new LeaseQueue(collections(db).queue),
      indexer: FAKE_INDEXER,
    }
  })

  afterAll(async () => {
    await client.close()
    await server.stop()
  })

  it('confirmAnchor upserts the anchors cache and flips status to anchored', async () => {
    await confirmAnchor(
      { credentialId: '0x' + 'aa'.repeat(32), receiptId: '0x' + 'cc'.repeat(32), txHash: '0x' + 'dd'.repeat(32) },
      deps,
    )
    const anchor = await deps.repos.anchors.get('0x' + 'aa'.repeat(32))
    expect(anchor).not.toBeNull()
    expect(anchor?.confirmed).toBe(true)
    expect(anchor?.confirmations).toBe(12)
    expect(anchor?.blockNumber).toBe(100)
  })

  it('reflectRevocation upserts the revocations cache when the credential exists', async () => {
    await deps.repos.credentials.insert({
      credentialId: '0x' + 'ee'.repeat(32),
      issuer: '0x1111111111111111111111111111111111111111',
      subject: 's',
      credential: {},
      evidence: {},
      issuerSignature: '0x',
      credentialHash: '0x',
      evidenceHash: '0x',
      receiptId: '0x' + 'ff'.repeat(32),
      status: 'anchored',
      anchorTxHash: '0x',
    })

    await reflectRevocation(
      { credentialId: '0x' + 'ee'.repeat(32), txHash: '0x' + 'a9'.repeat(32) },
      deps,
    )
    const rev = await deps.repos.revocations.get('0x' + 'ee'.repeat(32))
    expect(rev).not.toBeNull()
    expect(rev?.confirmed).toBe(true)
    expect(rev?.issuer).toBe('0x1111111111111111111111111111111111111111')
  })

  it('runDrain leases, dispatches, and acks a batch', async () => {
    await deps.queue.enqueue({
      type: 'confirmAnchor',
      dedupeKey: 'drain:1',
      payload: {
        credentialId: '0x' + 'aa'.repeat(32),
        receiptId: '0x' + 'cc'.repeat(32),
        txHash: '0x' + 'dd'.repeat(32),
      },
    })
    const processed = await runDrain(deps, 'confirmAnchor', 5, 0)
    expect(processed).toBe(1)
    expect(await deps.queue.depth('confirmAnchor')).toBe(0)
  })
})

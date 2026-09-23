import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { LeaseQueue } from '../src/queue.js'
import { collections, ensureIndexes } from '../src/mongo.js'
import { SKIP_MONGO_TESTS, startMemoryMongo, type MemoryMongo } from './helpers/memory-mongo.js'

describe.skipIf(SKIP_MONGO_TESTS)('LeaseQueue', () => {
  let mongo: MemoryMongo
  let queue: LeaseQueue

  beforeAll(async () => {
    mongo = await startMemoryMongo()
    await ensureIndexes(mongo.db)
  })

  afterAll(async () => {
    await mongo.stop()
  })

  afterEach(async () => {
    await collections(mongo.db).queue.deleteMany({})
  })

  it('enqueue is idempotent on dedupeKey', async () => {
    queue = new LeaseQueue(collections(mongo.db).queue)
    const first = await queue.enqueue({ type: 'confirmAnchor', dedupeKey: 'k1', payload: { a: 1 } })
    const second = await queue.enqueue({ type: 'confirmAnchor', dedupeKey: 'k1', payload: { a: 2 } })
    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(await queue.depth('confirmAnchor')).toBe(1)
  })

  it('leases pending jobs up to the batch size and not beyond', async () => {
    queue = new LeaseQueue(collections(mongo.db).queue)
    const now = 1_000
    await queue.enqueue({ type: 'confirmAnchor', dedupeKey: 'a', payload: {} }, now)
    await queue.enqueue({ type: 'confirmAnchor', dedupeKey: 'b', payload: {} }, now)
    const leased = await queue.lease('confirmAnchor', now, 30_000, 5)
    expect(leased).toHaveLength(2)
    // Nothing left to lease within the same instant.
    expect(await queue.lease('confirmAnchor', now, 30_000, 5)).toHaveLength(0)
  })

  it('does not lease jobs whose availableAt is in the future', async () => {
    queue = new LeaseQueue(collections(mongo.db).queue)
    await queue.enqueue({ type: 'confirmAnchor', dedupeKey: 'later', payload: {}, availableAt: 5_000 })
    expect(await queue.lease('confirmAnchor', 1_000, 30_000, 5)).toHaveLength(0)
    expect(await queue.lease('confirmAnchor', 5_000, 30_000, 5)).toHaveLength(1)
  })

  it('ack marks a job done so it is never leased again', async () => {
    queue = new LeaseQueue(collections(mongo.db).queue)
    await queue.enqueue({ type: 'confirmAnchor', dedupeKey: 'z', payload: {} }, 1_000)
    const [job] = await queue.lease('confirmAnchor', 1_000, 30_000, 1)
    await queue.ack(job.id, 1_100)
    expect(await queue.lease('confirmAnchor', 1_000_000, 30_000, 5)).toHaveLength(0)
    expect(await queue.depth('confirmAnchor')).toBe(0)
  })

  it('nack retries with backoff until maxAttempts, then fails', async () => {
    queue = new LeaseQueue(collections(mongo.db).queue)
    await queue.enqueue({ type: 'confirmAnchor', dedupeKey: 'r', payload: {}, maxAttempts: 2 }, 0)

    const [a1] = await queue.lease('confirmAnchor', 0, 30_000, 1)
    expect(a1.attempts).toBe(1)
    await queue.nack(a1.id, 'boom', 0)
    // Backed off into the future — not immediately runnable.
    expect(await queue.lease('confirmAnchor', 0, 30_000, 1)).toHaveLength(0)

    const [a2] = await queue.lease('confirmAnchor', 1_000_000, 30_000, 1)
    expect(a2.attempts).toBe(2)
    await queue.nack(a2.id, 'boom again', 1_000_000)

    // attempts >= maxAttempts → parked failed, never runnable again.
    expect(await queue.lease('confirmAnchor', 9_000_000, 30_000, 1)).toHaveLength(0)
    const doc = await collections(mongo.db).queue.findOne({ dedupeKey: 'r' })
    expect(doc?.status).toBe('failed')
    expect(doc?.lastError).toBe('boom again')
  })

  it('reapExpired returns expired leases to pending', async () => {
    queue = new LeaseQueue(collections(mongo.db).queue)
    await queue.enqueue({ type: 'reapExpired', dedupeKey: 'exp', payload: {} }, 0)
    const [job] = await queue.lease('reapExpired', 0, 10_000, 1)
    expect(job).toBeDefined()
    // Before the lease expires: nothing to reap.
    expect(await queue.reapExpired(5_000)).toBe(0)
    // After it expires: reclaimed.
    expect(await queue.reapExpired(20_000)).toBe(1)
    expect(await queue.lease('reapExpired', 20_000, 10_000, 1)).toHaveLength(1)
  })
})

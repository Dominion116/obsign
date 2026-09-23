import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sha256Hex } from '@obsign/core'
import { EvidenceTooLargeError, GRIDFS_SCHEME, GridFSEvidenceStore } from '../src/evidence-store.js'
import { evidenceBucket } from '../src/mongo.js'
import { SKIP_MONGO_TESTS, startMemoryMongo, type MemoryMongo } from './helpers/memory-mongo.js'

describe.skipIf(SKIP_MONGO_TESTS)('GridFSEvidenceStore', () => {
  let mongo: MemoryMongo

  beforeAll(async () => {
    mongo = await startMemoryMongo()
  })

  afterAll(async () => {
    await mongo.stop()
  })

  it('stores and retrieves bytes, content-addressed by sha256', async () => {
    const store = new GridFSEvidenceStore(evidenceBucket(mongo.db), 1_000)
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const res = await store.put(bytes)
    expect(res.uri.startsWith(GRIDFS_SCHEME)).toBe(true)
    expect(res.bytes).toBe(5)
    expect(res.sha256).toBe(sha256Hex(bytes))

    const roundTrip = await store.get(res.uri)
    expect(roundTrip).not.toBeNull()
    expect(Array.from(roundTrip!)).toEqual([1, 2, 3, 4, 5])
  })

  it('rejects uploads over the byte cap (SEC-5)', async () => {
    const store = new GridFSEvidenceStore(evidenceBucket(mongo.db), 4)
    await expect(store.put(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toBeInstanceOf(
      EvidenceTooLargeError,
    )
  })

  it('returns null for a malformed or missing uri', async () => {
    const store = new GridFSEvidenceStore(evidenceBucket(mongo.db), 1_000)
    expect(await store.get('not-a-gridfs-uri')).toBeNull()
    expect(await store.get(`${GRIDFS_SCHEME}000000000000000000000000`)).toBeNull()
  })

  it('snapshot builds a synchronous core EvidenceStore over prefetched bytes', async () => {
    const store = new GridFSEvidenceStore(evidenceBucket(mongo.db), 1_000)
    const bytes = new Uint8Array([9, 8, 7])
    const { uri } = await store.put(bytes)
    const sync = await store.snapshot([uri])
    expect(Array.from(sync.get(uri)!)).toEqual([9, 8, 7])
    expect(sync.get('gridfs://deadbeef')).toBeNull()
  })
})

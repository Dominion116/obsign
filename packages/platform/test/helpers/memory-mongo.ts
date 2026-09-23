// Shared in-memory Mongo harness for platform unit tests. Secret-free: it spins
// up an ephemeral mongod (mongodb-memory-server), so CI needs no MONGODB_URI.
//
// Windows caveat (per plan): the mongod binary download is slow/flaky on the
// Windows CI leg, so Mongo-dependent suites guard with `describe.skipIf(
// SKIP_MONGO_TESTS)` and run ubuntu-only. Pure-logic tests stay cross-OS.

import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, type Db } from 'mongodb'

export const SKIP_MONGO_TESTS = process.platform === 'win32'

export interface MemoryMongo {
  db: Db
  client: MongoClient
  stop: () => Promise<void>
}

/** Start an ephemeral mongod and connect a client to a fresh test database. */
export async function startMemoryMongo(): Promise<MemoryMongo> {
  const server = await MongoMemoryServer.create()
  const client = await MongoClient.connect(server.getUri())
  const db = client.db('obsign_platform_test')
  return {
    db,
    client,
    stop: async () => {
      await client.close()
      await server.stop()
    },
  }
}

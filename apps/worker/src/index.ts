// apps/worker — confirm/index pipeline handlers (P3-4). Each handler is a pure
// function over @obsign/platform: given a job payload, do the idempotent work.
// `runDrain` leases a bounded batch, dispatches by type, and acks/nacks. The
// same handler run twice must converge on a single cached row (INV-4).

import type { Db } from 'mongodb'
import {
  ChainIndexer,
  collections,
  createRepositories,
  ensureIndexes,
  getMongoClient,
  LeaseQueue,
  type PlatformConfig,
  type Repositories,
  type ConfirmAnchorResult,
  type ConfirmRevocationResult,
} from '@obsign/platform'

export type Handler<P> = (payload: P) => Promise<unknown>

export interface ConfirmAnchorPayload {
  credentialId: string
  receiptId: string
  txHash: string
}

export interface ReflectRevocationPayload {
  credentialId: string
  txHash: string
}

export interface WorkerDeps {
  db: Db
  repos: Repositories
  queue: LeaseQueue
  indexer: ChainIndexer
}

/** Confirm an anchor tx: wait for >= min confirmations, then upsert the cache. */
export async function confirmAnchor(
  payload: ConfirmAnchorPayload,
  deps: WorkerDeps,
): Promise<ConfirmAnchorResult> {
  const { credentialId, receiptId, txHash } = payload
  const result = await deps.indexer.confirmAnchor(txHash as `0x${string}`, receiptId as `0x${string}`)
  await deps.repos.anchors.upsert({
    credentialId,
    receiptId,
    txHash,
    blockNumber: result.blockNumber,
    blockHash: result.blockHash,
    confirmations: result.confirmations,
    confirmed: result.confirmed,
  })
  if (result.confirmed) {
    await deps.repos.credentials.setStatus(credentialId, 'anchored')
  }
  return result
}

/** Confirm a revocation tx and reflect it into the revocations cache. */
export async function reflectRevocation(
  payload: ReflectRevocationPayload,
  deps: WorkerDeps,
): Promise<ConfirmRevocationResult> {
  const { credentialId, txHash } = payload
  const cred = await deps.repos.credentials.get(credentialId)
  if (!cred) {
    return { confirmed: false, confirmations: 0 }
  }
  const result = await deps.indexer.confirmRevocation(
    txHash as `0x${string}`,
    credentialId,
    cred.issuer as `0x${string}`,
  )
  await deps.repos.revocations.upsert({
    credentialId,
    issuer: cred.issuer,
    txHash,
    blockNumber: result.blockNumber,
    confirmations: result.confirmations,
    confirmed: result.confirmed,
  })
  return result
}

type DispatchHandler = (payload: Record<string, unknown>, deps: WorkerDeps) => Promise<unknown>

const HANDLERS: Record<string, DispatchHandler> = {
  confirmAnchor: (payload, deps) => confirmAnchor(payload as unknown as ConfirmAnchorPayload, deps),
  reflectRevocation: (payload, deps) =>
    reflectRevocation(payload as unknown as ReflectRevocationPayload, deps),
}

/** How long to wait before re-polling a tx that has not yet confirmed. */
export const DEFER_MS = 15_000

/** True when a handler result says "not confirmed yet" (poll again later). */
function notYetConfirmed(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'confirmed' in result &&
    (result as { confirmed: unknown }).confirmed === false
  )
}

/**
 * Lease and drain up to `limit` jobs of one type. Returns the number of jobs
 * acked. A handler that returns `confirmed:false` is deferred (re-polled later)
 * rather than acked or failed; a throw is nacked with backoff. Idempotent
 * handlers make re-runs converge (INV-4).
 */
export async function runDrain(
  deps: WorkerDeps,
  type: string,
  limit: number,
  now: number = Date.now(),
): Promise<number> {
  const handler = HANDLERS[type]
  if (!handler) return 0
  let processed = 0
  const jobs = await deps.queue.lease(type as never, now, 60_000, limit)
  for (const job of jobs) {
    try {
      const result = await handler(job.payload, deps)
      if (notYetConfirmed(result)) {
        await deps.queue.defer(job.id, now + DEFER_MS, now)
      } else {
        await deps.queue.ack(job.id, now)
        processed++
      }
    } catch (err) {
      await deps.queue.nack(job.id, err instanceof Error ? err.message : String(err), now)
    }
  }
  return processed
}

/** Reap expired leases (crash recovery). */
export async function reapExpired(deps: WorkerDeps, now: number = Date.now()): Promise<number> {
  return deps.queue.reapExpired(now)
}

/** Build the deps graph from a Mongo Db and platform config. */
export function buildWorkerDeps(db: Db, config: PlatformConfig): WorkerDeps {
  return {
    db,
    repos: createRepositories(db),
    queue: new LeaseQueue(collections(db).queue),
    indexer: new ChainIndexer({
      rpcUrl: config.rpcUrl,
      addresses: {
        anchor: config.anchorAddress as `0x${string}`,
        revocation: config.revocationAddress as `0x${string}`,
        issuerRegistry: config.issuerRegistryAddress as `0x${string}`,
        policyRegistry: config.policyRegistryAddress as `0x${string}`,
      },
      minConfirmations: config.anchorMinConfirmations,
    }),
  }
}

/** Bootstrap the worker: connect Mongo, ensure indexes, return deps. */
export async function startWorker(config: PlatformConfig): Promise<WorkerDeps> {
  const client = await getMongoClient(config.mongoUri)
  const db = client.db()
  await ensureIndexes(db)
  return buildWorkerDeps(db, config)
}
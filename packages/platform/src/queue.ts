// Lease-based durable job queue over the `queue` collection. This is the spine
// of the confirm/index pipeline (P3-4): the API enqueues jobs, the worker leases
// a bounded batch, does idempotent work, then acks (or nacks with backoff). A
// crashed worker's lease expires and the job is reclaimed — at-least-once
// delivery, with idempotent handlers giving effectively-once results (INV-4).

import type { Collection, ObjectId, WithId } from 'mongodb'
import type { JobDoc, JobType } from './types.js'

export interface EnqueueInput<P = Record<string, unknown>> {
  type: JobType
  /** Idempotency key. A second enqueue with the same key is a no-op. */
  dedupeKey: string
  payload: P
  maxAttempts?: number
  /** Earliest epoch-ms the job may be leased (default: now). */
  availableAt?: number
}

export interface LeasedJob<P = Record<string, unknown>> {
  id: ObjectId
  type: JobType
  dedupeKey: string
  payload: P
  attempts: number
}

export const DEFAULT_MAX_ATTEMPTS = 5
export const DEFAULT_LEASE_TTL_MS = 60_000
const BACKOFF_BASE_MS = 5_000

/** Exponential backoff (capped) for a retry after the Nth failed attempt. */
function backoffMs(attempts: number): number {
  const ms = BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1)
  return Math.min(ms, 5 * 60_000)
}

export class LeaseQueue {
  constructor(private readonly col: Collection<JobDoc>) {}

  /**
   * Idempotently enqueue a job. Returns true when a new job was inserted, false
   * when `dedupeKey` already existed (the unique index enforces this).
   */
  async enqueue<P>(input: EnqueueInput<P>, now: number = Date.now()): Promise<boolean> {
    const res = await this.col.updateOne(
      { dedupeKey: input.dedupeKey },
      {
        $setOnInsert: {
          type: input.type,
          dedupeKey: input.dedupeKey,
          payload: input.payload as Record<string, unknown>,
          status: 'pending',
          attempts: 0,
          maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
          availableAt: input.availableAt ?? now,
          leaseExpiresAt: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    )
    return res.upsertedCount === 1
  }

  /**
   * Atomically lease up to `batch` runnable jobs of one type. A job is runnable
   * when it is `pending` and due, or `leased` with an expired lease (crash
   * recovery). Each claim increments `attempts` and sets a fresh lease.
   */
  async lease<P>(
    type: JobType,
    now: number,
    ttlMs: number,
    batch: number,
  ): Promise<LeasedJob<P>[]> {
    const out: LeasedJob<P>[] = []
    for (let i = 0; i < batch; i++) {
      const job = (await this.col.findOneAndUpdate(
        {
          type,
          availableAt: { $lte: now },
          $or: [{ status: 'pending' }, { status: 'leased', leaseExpiresAt: { $lte: now } }],
        },
        {
          $set: { status: 'leased', leaseExpiresAt: now + ttlMs, updatedAt: now },
          $inc: { attempts: 1 },
        },
        { sort: { availableAt: 1 }, returnDocument: 'after' },
      )) as WithId<JobDoc> | null
      if (!job) break
      out.push({
        id: job._id,
        type: job.type,
        dedupeKey: job.dedupeKey,
        payload: job.payload as P,
        attempts: job.attempts,
      })
    }
    return out
  }

  /** Mark a leased job successfully done. */
  async ack(id: ObjectId, now: number = Date.now()): Promise<void> {
    await this.col.updateOne(
      { _id: id },
      { $set: { status: 'done', leaseExpiresAt: 0, updatedAt: now } },
    )
  }

  /**
   * Reschedule a leased job for a later poll WITHOUT counting it as a failed
   * attempt. Used when work is not an error but simply "not ready yet" (e.g. a
   * tx has not reached the required confirmations). Decrements `attempts` so the
   * retry budget is spent only on real failures (via {@link nack}).
   */
  async defer(id: ObjectId, availableAt: number, now: number = Date.now()): Promise<void> {
    await this.col.updateOne(
      { _id: id },
      {
        $set: { status: 'pending', availableAt, leaseExpiresAt: 0, updatedAt: now },
        $inc: { attempts: -1 },
      },
    )
  }

  /**
   * Report a failed attempt. Retries with exponential backoff until
   * `maxAttempts` is reached, then parks the job as `failed`.
   */
  async nack(id: ObjectId, error: string, now: number = Date.now()): Promise<void> {
    const job = await this.col.findOne({ _id: id })
    if (!job) return
    if (job.attempts >= job.maxAttempts) {
      await this.col.updateOne(
        { _id: id },
        { $set: { status: 'failed', lastError: error, leaseExpiresAt: 0, updatedAt: now } },
      )
      return
    }
    await this.col.updateOne(
      { _id: id },
      {
        $set: {
          status: 'pending',
          lastError: error,
          availableAt: now + backoffMs(job.attempts),
          leaseExpiresAt: 0,
          updatedAt: now,
        },
      },
    )
  }

  /**
   * Reclaim jobs whose lease expired while still `leased` (the worker died mid
   * job). They return to `pending` and become immediately runnable. Returns the
   * number of jobs reaped.
   */
  async reapExpired(now: number = Date.now()): Promise<number> {
    const res = await this.col.updateMany(
      { status: 'leased', leaseExpiresAt: { $lte: now, $gt: 0 } },
      { $set: { status: 'pending', availableAt: now, leaseExpiresAt: 0, updatedAt: now } },
    )
    return res.modifiedCount
  }

  /** Count runnable (`pending`) jobs, optionally for one type (health/OBS-3). */
  async depth(type?: JobType): Promise<number> {
    return this.col.countDocuments(type ? { type, status: 'pending' } : { status: 'pending' })
  }
}

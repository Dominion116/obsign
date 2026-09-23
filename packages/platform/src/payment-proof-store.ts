// Single-use x402 payment-proof persistence (Phase 4, FR-4.4). A proof is
// "consumed" exactly once; a replay of the same proofId is a Mongo duplicate-key
// error, which we translate into a boolean the middleware turns into a 402.
//
// INV-4: this is a replay-guard cache. It never affects a verdict or a receiptId
// (those are pure, @obsign/core's job), and payment never affects validity
// (INV-3). Recomputation of a receipt never consults this store.

import type { Collection } from 'mongodb'
import type { PaymentProofDoc } from './types.js'

/** Fields the middleware records when a proof is settled. */
export interface ConsumeProofInput {
  proofId: string
  resource: string
  amount: string
  payer?: string
  txHash?: string
}

/** Mongo duplicate-key error code (single source of truth for the replay check). */
const DUPLICATE_KEY = 11000

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === DUPLICATE_KEY
  )
}

export class PaymentProofStore {
  constructor(private readonly proofs: Collection<PaymentProofDoc>) {}

  /**
   * Atomically record a proof as consumed. Returns `true` when this is the first
   * time (payment may proceed) and `false` when the proof was already used (a
   * replay — the caller MUST reject with 402). Relies on the unique `proofId`
   * index, so the check is race-free across concurrent requests/instances.
   */
  async consume(input: ConsumeProofInput): Promise<boolean> {
    const doc: PaymentProofDoc = {
      proofId: input.proofId,
      resource: input.resource,
      amount: input.amount,
      consumedAt: new Date(),
    }
    if (input.payer !== undefined) doc.payer = input.payer
    if (input.txHash !== undefined) doc.txHash = input.txHash
    try {
      await this.proofs.insertOne(doc)
      return true
    } catch (err) {
      if (isDuplicateKeyError(err)) return false
      throw err
    }
  }

  /** Whether a proofId has already been consumed (diagnostics/tests). */
  async has(proofId: string): Promise<boolean> {
    return (await this.proofs.findOne({ proofId })) !== null
  }
}

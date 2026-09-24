// Pay-and-verify: call the Obsign REST verify endpoint (the same shared core path
// the MCP `obsign_verify` tool uses) and, when it returns HTTP 402, autonomously
// construct + submit an x402 payment and retry — no human approval (FR-6). The
// verdict/receiptId come only from the server's @obsign/core computation (INV-3).

import { ObsignClient, X402PaymentRequiredError } from '@obsign/sdk'
import type { Receipt } from '@obsign/core'
import type { AgentWallet, PaymentRequirements } from './wallet.js'

export interface PayAndVerifyInput {
  client: ObsignClient
  /** When null, an x402 challenge cannot be paid and is surfaced as `unpaid`. */
  wallet: AgentWallet | null
  credential: unknown
  evidence: unknown
  now?: string
}

export type PayAndVerifyResult =
  | { kind: 'verified'; receipt: Receipt; paid: boolean; payer?: string }
  | { kind: 'unpaid'; error: string }

function firstRequirements(challenge: { accepts: unknown[] }): PaymentRequirements | null {
  const item = challenge.accepts[0]
  return item && typeof item === 'object' ? (item as PaymentRequirements) : null
}

/**
 * Verify a credential, paying via x402 if challenged. Returns `verified` with the
 * receipt (paid indicates whether a payment was needed), or `unpaid` when payment
 * was required but no wallet is available to settle it.
 */
export async function payAndVerify(input: PayAndVerifyInput): Promise<PayAndVerifyResult> {
  const opts: { now?: string } = {}
  if (typeof input.now === 'string') opts.now = input.now

  try {
    const receipt = await input.client.verify(input.credential, input.evidence, opts)
    return { kind: 'verified', receipt, paid: false }
  } catch (err) {
    if (!(err instanceof X402PaymentRequiredError)) throw err
    if (!input.wallet) {
      return { kind: 'unpaid', error: err.challenge.error || 'payment required' }
    }
    const requirements = firstRequirements(err.challenge)
    if (!requirements) return { kind: 'unpaid', error: 'no payment requirements advertised' }

    const payment = await input.wallet.buildPaymentHeader(requirements)
    const receipt = await input.client.verify(input.credential, input.evidence, {
      ...opts,
      payment,
    })
    return { kind: 'verified', receipt, paid: true, payer: input.wallet.address }
  }
}

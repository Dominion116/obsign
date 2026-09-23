// x402 payment gate (Phase 4, FR-4.2..FR-4.4). This is pure middleware: it
// decides whether a request has paid, and NOTHING here touches the credential,
// the evidence, the verdict, or any hash (INV-3). Payment is an economic gate in
// front of the pure verifier, never a validity input.
//
// Flow:
//   1. No X-PAYMENT header            → 402 with payment requirements (challenge).
//   2. X-PAYMENT present but invalid  → 402 (facilitator rejected it).
//   3. Valid but proof already used   → 402 (single-use replay guard, FR-4.4).
//   4. Valid + fresh + settled        → paid; the route runs the verifier.
//
// The facilitator (verify/settle) is injected so the live Base Sepolia path is
// exercised only in secret-gated integration tests; unit tests stub it.

import { bytesToHex, canonicalBytes, keccak256 } from '@obsign/core'
import type { PaymentProofStore } from '@obsign/platform'

/** The x402 protocol version this service speaks. */
export const X402_VERSION = 1

/** A single payment option advertised in a 402 challenge (x402 `accepts` item). */
export interface X402PaymentRequirements {
  scheme: string
  network: string
  maxAmountRequired: string
  resource: string
  description: string
  mimeType: string
  payTo: string
  maxTimeoutSeconds: number
  asset: string
}

/** A decoded X-PAYMENT payload (opaque to us; the facilitator interprets it). */
export interface X402Payment {
  x402Version: number
  scheme: string
  network: string
  payload: Record<string, unknown>
}

/** The 402 body a client receives when payment is required or rejected. */
export interface X402Challenge {
  x402Version: number
  error: string
  accepts: X402PaymentRequirements[]
}

export interface FacilitatorVerifyResult {
  isValid: boolean
  invalidReason?: string
  payer?: string
}

export interface FacilitatorSettleResult {
  success: boolean
  errorReason?: string
  txHash?: string
  payer?: string
}

/** The facilitator surface the gate depends on (injected, stubbable). */
export interface FacilitatorClient {
  verify(
    payment: X402Payment,
    requirements: X402PaymentRequirements,
  ): Promise<FacilitatorVerifyResult>
  settle(
    payment: X402Payment,
    requirements: X402PaymentRequirements,
  ): Promise<FacilitatorSettleResult>
}

export type X402Outcome =
  | {
      paid: true
      payment: X402Payment
      requirements: X402PaymentRequirements
      proofId: string
      payer?: string
      txHash?: string
    }
  | { paid: false; status: 402; challenge: X402Challenge }

export interface X402GateOptions {
  payeeAddress: string
  priceUsdc: string
  facilitator: FacilitatorClient
  proofs: PaymentProofStore
  network?: string
  asset?: string
  logger?: { warn(obj: unknown, msg?: string): void }
}

type Headers = Record<string, string | string[] | undefined>

function headerValue(headers: Headers, name: string): string | undefined {
  const v = headers[name]
  return Array.isArray(v) ? v[0] : v
}

/** Decode a base64url/base64 X-PAYMENT header into a payment object, or null. */
function decodePayment(raw: string): X402Payment | null {
  try {
    const json = Buffer.from(raw, 'base64').toString('utf8')
    const obj = JSON.parse(json) as Record<string, unknown>
    if (!obj || typeof obj !== 'object') return null
    return {
      x402Version: typeof obj.x402Version === 'number' ? obj.x402Version : X402_VERSION,
      scheme: typeof obj.scheme === 'string' ? obj.scheme : 'exact',
      network: typeof obj.network === 'string' ? obj.network : 'base-sepolia',
      payload: (obj.payload ?? {}) as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

/**
 * Deterministic replay key for a payment. Prefer the payload signature (the
 * unique authorization artifact); otherwise hash the whole canonicalized payment
 * so identical payments collide and distinct ones do not.
 */
export function deriveProofId(payment: X402Payment): string {
  const sig = payment.payload.signature
  if (typeof sig === 'string' && sig.length > 0) return sig.toLowerCase()
  return bytesToHex(keccak256(canonicalBytes(payment)))
}

export class X402Gate {
  constructor(private readonly opts: X402GateOptions) {}

  /** Build the payment requirements advertised for a resource. */
  requirements(resource: string): X402PaymentRequirements {
    return {
      scheme: 'exact',
      network: this.opts.network ?? 'base-sepolia',
      maxAmountRequired: this.opts.priceUsdc,
      resource,
      description: 'Obsign credential verification',
      mimeType: 'application/json',
      payTo: this.opts.payeeAddress,
      maxTimeoutSeconds: 60,
      asset: this.opts.asset ?? '',
    }
  }

  private challenge(resource: string, error: string): X402Outcome {
    return {
      paid: false,
      status: 402,
      challenge: { x402Version: X402_VERSION, error, accepts: [this.requirements(resource)] },
    }
  }

  /**
   * Decide whether the request has paid for `resource`. Returns a `paid: true`
   * outcome the route can act on, or a `paid: false` 402 challenge to return
   * verbatim. Never throws for the ordinary rejection paths.
   */
  async settle(headers: Headers, resource: string): Promise<X402Outcome> {
    const requirements = this.requirements(resource)
    const raw = headerValue(headers, 'x-payment')
    if (!raw) return this.challenge(resource, 'payment required')

    const payment = decodePayment(raw)
    if (!payment) return this.challenge(resource, 'malformed X-PAYMENT header')

    // 1. Facilitator verifies the payment authorization against requirements.
    let verified: FacilitatorVerifyResult
    try {
      verified = await this.opts.facilitator.verify(payment, requirements)
    } catch (err) {
      return this.challenge(
        resource,
        `facilitator unavailable: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    if (!verified.isValid) {
      return this.challenge(resource, verified.invalidReason ?? 'invalid payment')
    }

    // 2. Single-use guard (FR-4.4): a replayed proof is rejected and logged.
    const proofId = deriveProofId(payment)
    const fresh = await this.opts.proofs.consume({
      proofId,
      resource,
      amount: requirements.maxAmountRequired,
      ...(verified.payer !== undefined ? { payer: verified.payer } : {}),
    })
    if (!fresh) {
      this.opts.logger?.warn({ proofId, resource }, 'x402 payment proof replay rejected')
      return this.challenge(resource, 'payment proof already used')
    }

    // 3. Settle on-chain via the facilitator.
    let settled: FacilitatorSettleResult
    try {
      settled = await this.opts.facilitator.settle(payment, requirements)
    } catch (err) {
      return this.challenge(
        resource,
        `settlement failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    if (!settled.success) {
      return this.challenge(resource, settled.errorReason ?? 'settlement failed')
    }

    const payer = settled.payer ?? verified.payer
    return {
      paid: true,
      payment,
      requirements,
      proofId,
      ...(payer !== undefined ? { payer } : {}),
      ...(settled.txHash !== undefined ? { txHash: settled.txHash } : {}),
    }
  }
}

/** Minimal fetch surface, so we do not depend on DOM/undici lib types. */
type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

/**
 * A facilitator client backed by the standard x402 facilitator HTTP API
 * (`POST {base}/verify`, `POST {base}/settle`). Used in production; the live path
 * is only exercised by secret-gated integration tests.
 */
export function createHttpFacilitator(baseUrl: string, fetchImpl?: FetchLike): FacilitatorClient {
  const doFetch = (fetchImpl ?? (globalThis.fetch as unknown as FetchLike)) as FetchLike
  const base = baseUrl.replace(/\/+$/, '')

  async function post(path: string, payment: X402Payment, requirements: X402PaymentRequirements) {
    const res = await doFetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        x402Version: X402_VERSION,
        paymentPayload: payment,
        paymentRequirements: requirements,
      }),
    })
    const text = await res.text()
    const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>
    return { ok: res.ok, body }
  }

  return {
    async verify(payment, requirements) {
      const { ok, body } = await post('/verify', payment, requirements)
      const result: FacilitatorVerifyResult = { isValid: ok && body.isValid === true }
      if (typeof body.invalidReason === 'string') result.invalidReason = body.invalidReason
      if (typeof body.payer === 'string') result.payer = body.payer
      return result
    },
    async settle(payment, requirements) {
      const { ok, body } = await post('/settle', payment, requirements)
      const result: FacilitatorSettleResult = { success: ok && body.success === true }
      if (typeof body.errorReason === 'string') result.errorReason = body.errorReason
      if (typeof body.txHash === 'string') result.txHash = body.txHash
      if (typeof body.transaction === 'string') result.txHash = body.transaction
      if (typeof body.payer === 'string') result.payer = body.payer
      return result
    },
  }
}

// x402 payment gate (Phase 4, FR-4.2..FR-4.4), x402 protocol **v1** (Base Sepolia
// name-based flow — see X402_VERSION). This is pure
// middleware: it decides whether a request has paid, and NOTHING here touches the
// credential, the evidence, the verdict, or any hash (INV-3). Payment is an
// economic gate in front of the pure verifier, never a validity input.
//
// Flow:
//   1. No payment header             → 402 + PAYMENT-REQUIRED (the challenge).
//   2. Header present but invalid    → 402 (facilitator rejected it).
//   3. Valid but proof already used  → 402 (single-use replay guard, FR-4.4).
//   4. Valid + fresh + settled       → paid; the route runs the verifier.
//
// Wire format (x402, validated against the reference `x402-fetch` client + the
// public facilitator):
//   - request header  PAYMENT-SIGNATURE  (base64 PaymentPayload); we also accept
//     the v1 X-PAYMENT header for backward compatibility.
//   - 402 response header PAYMENT-REQUIRED  (base64 of the accepts array).
//   - 200 response header PAYMENT-RESPONSE  (base64 of the settlement response).
//   - Each `accepts` item is an x402 PaymentRequirements: `network` is the x402
//     network NAME (base-sepolia, mapped from the configured CAIP-2 id), the price
//     is `maxAmountRequired` in atomic units, `resource` is an absolute URL, and
//     `extra` = { name, version } is the asset's EIP-712 domain used to build the
//     EIP-3009 authorization.
//
// The facilitator (verify/settle) is injected so the live Base Sepolia path is
// exercised only in secret-gated integration tests; unit tests stub it.

import { bytesToHex, canonicalBytes, keccak256 } from '@obsign/core'
import type { PaymentProofStore } from '@obsign/platform'

/** The x402 protocol version this service speaks. The public facilitator only
 * registers `scheme: exact` on `base-sepolia` under x402Version 1 (v2 expects
 * CAIP-2 network ids that the reference client does not emit), so v1 is the
 * interoperable choice for the Base Sepolia name-based flow. */
export const X402_VERSION = 1

/**
 * A single payment option advertised in a 402 challenge — an x402
 * `PaymentRequirements`. Field names/shape match the x402 schema the reference
 * client (`x402-fetch`) and the public facilitator validate against: `network`
 * is the x402 network NAME (not CAIP-2), the price is `maxAmountRequired`, and
 * `resource` is an absolute URL.
 */
export interface X402PaymentRequirements {
  scheme: string
  /** x402 network name, e.g. "base-sepolia" (NOT the CAIP-2 id). */
  network: string
  /** Price in the asset's atomic units (USDC 6dp: "10000" = 0.01). */
  maxAmountRequired: string
  /** ERC-20 asset contract address. */
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  /** Absolute URL of the paid resource (x402 requires a URL, not a path). */
  resource: string
  description: string
  mimeType: string
  /** Exact-scheme EVM EIP-712 domain of the asset: { name, version }. */
  extra: Record<string, unknown>
}

/**
 * Map a configured network id to the canonical x402 network NAME the reference
 * client and facilitator expect. Accepts a CAIP-2 id (eip155:84532) or an
 * already-canonical name (base-sepolia), so config may use either form.
 */
const X402_NETWORK_NAMES: Record<string, string> = {
  'eip155:84532': 'base-sepolia',
  'eip155:8453': 'base',
}
export function toX402Network(network: string): string {
  return X402_NETWORK_NAMES[network] ?? network
}

/** A decoded payment header payload (opaque to us; the facilitator interprets it). */
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
  network?: string
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
      /** base64 PAYMENT-RESPONSE header the route should echo on 200. */
      settlementHeader: string
      payer?: string
      txHash?: string
    }
  | {
      paid: false
      status: 402
      challenge: X402Challenge
      /** base64 PAYMENT-REQUIRED header the route should set on the 402. */
      challengeHeader: string
    }

export interface X402GateOptions {
  payeeAddress: string
  /** Amount in atomic units of the asset. */
  amount: string
  /** CAIP-2 network id. */
  network: string
  /** ERC-20 asset (USDC) contract address. */
  asset: string
  /** EIP-712 domain name of the asset. */
  assetName: string
  /** EIP-712 domain version of the asset. */
  assetVersion: string
  facilitator: FacilitatorClient
  proofs: PaymentProofStore
  logger?: { warn(obj: unknown, msg?: string): void }
}

type Headers = Record<string, string | string[] | undefined>

function headerValue(headers: Headers, name: string): string | undefined {
  const v = headers[name]
  return Array.isArray(v) ? v[0] : v
}

/** Base64-encode a JSON value for an x402 header. */
function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
}

/** Decode a base64 payment header into a payment object, or null. */
function decodePayment(raw: string): X402Payment | null {
  try {
    const json = Buffer.from(raw, 'base64').toString('utf8')
    const obj = JSON.parse(json) as Record<string, unknown>
    if (!obj || typeof obj !== 'object') return null
    // v2 nests the selected requirements under `accepted`; older payloads put the
    // scheme/network at the top level. Read either, defaulting to our own.
    const accepted = (obj.accepted ?? {}) as Record<string, unknown>
    return {
      x402Version: typeof obj.x402Version === 'number' ? obj.x402Version : X402_VERSION,
      scheme:
        typeof obj.scheme === 'string'
          ? obj.scheme
          : typeof accepted.scheme === 'string'
            ? accepted.scheme
            : 'exact',
      network:
        typeof obj.network === 'string'
          ? obj.network
          : typeof accepted.network === 'string'
            ? accepted.network
            : '',
      payload: (obj.payload ?? {}) as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

/**
 * Deterministic replay key for a payment. Prefer the EIP-3009 authorization nonce
 * (the token-enforced single-use value), then the payload signature, then a hash
 * of the whole canonicalized payment so identical payments collide.
 */
export function deriveProofId(payment: X402Payment): string {
  const auth = payment.payload.authorization as Record<string, unknown> | undefined
  if (auth && typeof auth.nonce === 'string' && auth.nonce.length > 0) {
    return auth.nonce.toLowerCase()
  }
  const sig = payment.payload.signature
  if (typeof sig === 'string' && sig.length > 0) return sig.toLowerCase()
  return bytesToHex(keccak256(canonicalBytes(payment)))
}

export class X402Gate {
  constructor(private readonly opts: X402GateOptions) {}

  /** Build the payment requirements advertised for a resource (x402). */
  requirements(resource: string): X402PaymentRequirements {
    return {
      scheme: 'exact',
      network: toX402Network(this.opts.network),
      maxAmountRequired: this.opts.amount,
      asset: this.opts.asset,
      payTo: this.opts.payeeAddress,
      maxTimeoutSeconds: 60,
      resource,
      description: 'Obsign credential verification',
      mimeType: 'application/json',
      extra: {
        name: this.opts.assetName,
        version: this.opts.assetVersion,
      },
    }
  }

  private challenge(resource: string, error: string): X402Outcome {
    const accepts = [this.requirements(resource)]
    return {
      paid: false,
      status: 402,
      challenge: { x402Version: X402_VERSION, error, accepts },
      challengeHeader: b64(accepts),
    }
  }

  /**
   * Decide whether the request has paid for `resource`. Returns a `paid: true`
   * outcome the route can act on, or a `paid: false` 402 challenge to return
   * verbatim. Never throws for the ordinary rejection paths.
   */
  async settle(headers: Headers, resource: string): Promise<X402Outcome> {
    const requirements = this.requirements(resource)
    // Prefer the v2 header; accept the v1 header for backward compatibility.
    const raw = headerValue(headers, 'payment-signature') ?? headerValue(headers, 'x-payment')
    if (!raw) return this.challenge(resource, 'payment required')

    const payment = decodePayment(raw)
    if (!payment) return this.challenge(resource, 'malformed payment header')

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
    const settlementHeader = b64({
      success: true,
      network: settled.network ?? requirements.network,
      ...(settled.txHash !== undefined ? { transaction: settled.txHash } : {}),
      ...(payer !== undefined ? { payer } : {}),
    })
    return {
      paid: true,
      payment,
      requirements,
      proofId,
      settlementHeader,
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
 * is only exercised by secret-gated integration tests. The public testnet
 * facilitator is https://x402.org/facilitator (Base Sepolia + Solana devnet).
 */
export function createHttpFacilitator(baseUrl: string, fetchImpl?: FetchLike): FacilitatorClient {
  const doFetch = (fetchImpl ?? (globalThis.fetch as unknown as FetchLike)) as FetchLike
  const base = baseUrl.replace(/\/+$/, '')

  async function post(path: string, payment: X402Payment, requirements: X402PaymentRequirements) {
    const res = await doFetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        x402Version: payment.x402Version ?? X402_VERSION,
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
      // v2 reports the broadcast tx as `transaction`; keep `txHash` as a fallback.
      if (typeof body.transaction === 'string') result.txHash = body.transaction
      if (typeof body.txHash === 'string') result.txHash = body.txHash
      if (typeof body.network === 'string') result.network = body.network
      if (typeof body.payer === 'string') result.payer = body.payer
      return result
    },
  }
}

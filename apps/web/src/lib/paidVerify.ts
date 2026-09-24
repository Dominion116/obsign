// In-browser x402 paid verification. The connected wallet signs an EIP-3009
// `transferWithAuthorization` (gasless for the payer — the facilitator submits
// it), which lets the browser satisfy the x402 gate on POST /api/v1/verify and
// receive a `paid: true` receipt. Mirrors the agent's server-side payer, but the
// signature comes from the user's wallet instead of a private key.

import type { Receipt } from './api'

const BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')

/** The subset of an x402 PaymentRequirements the browser payer needs. */
export interface PaymentRequirements {
  scheme: string
  network: string
  maxAmountRequired: string
  asset: string
  payTo: string
  maxTimeoutSeconds?: number
  extra?: { name?: string; version?: string }
}

/** EIP-712 type set for USDC's transferWithAuthorization (x402 exact scheme). */
export const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

export interface Authorization {
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: `0x${string}`
  }
  message: {
    from: `0x${string}`
    to: `0x${string}`
    value: bigint
    validAfter: bigint
    validBefore: bigint
    nonce: `0x${string}`
  }
}

function randomNonce32(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

/** Load a stored credential's exact signed inputs (credential + evidence). */
export async function fetchCredentialInputs(
  credentialId: string,
): Promise<{ credential: unknown; evidence: unknown }> {
  const res = await fetch(`${BASE}/api/v1/credentials/${encodeURIComponent(credentialId)}`)
  if (!res.ok) throw new Error(`Credential not found (${res.status}).`)
  const doc = (await res.json()) as { credential?: unknown; evidence?: unknown }
  if (!doc.credential) throw new Error('That credential has no stored inputs to verify.')
  return { credential: doc.credential, evidence: doc.evidence ?? [] }
}

export type ChallengeResult =
  | { kind: 'receipt'; receipt: Receipt }
  | { kind: 'challenge'; requirements: PaymentRequirements }

/** First verify attempt (unpaid). Returns a receipt (if open) or the 402 challenge. */
export async function requestChallenge(
  credential: unknown,
  evidence: unknown,
): Promise<ChallengeResult> {
  const res = await fetch(`${BASE}/api/v1/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential, evidence }),
  })
  const text = await res.text()
  const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>
  if (res.status === 402) {
    const accepts = (body.accepts as PaymentRequirements[] | undefined) ?? []
    if (!accepts[0]) throw new Error('402 challenge advertised no payment requirements.')
    return { kind: 'challenge', requirements: accepts[0] }
  }
  if (!res.ok) throw new Error(String(body.error ?? `Verify failed (${res.status}).`))
  return { kind: 'receipt', receipt: body as unknown as Receipt }
}

/** Build the EIP-712 authorization the wallet must sign for these requirements. */
export function buildAuthorization(
  req: PaymentRequirements,
  from: `0x${string}`,
  chainId: number,
): Authorization {
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + (req.maxTimeoutSeconds ?? 60))
  return {
    domain: {
      name: req.extra?.name ?? 'USDC',
      version: req.extra?.version ?? '2',
      chainId,
      verifyingContract: req.asset as `0x${string}`,
    },
    message: {
      from,
      to: req.payTo as `0x${string}`,
      value: BigInt(req.maxAmountRequired),
      validAfter: 0n,
      validBefore,
      nonce: randomNonce32(),
    },
  }
}

/** Encode the signed authorization into a base64 x402 payment header. */
export function encodePaymentHeader(
  req: PaymentRequirements,
  auth: Authorization,
  signature: string,
): string {
  const payload = {
    x402Version: 1,
    scheme: req.scheme || 'exact',
    network: req.network,
    payload: {
      signature,
      authorization: {
        from: auth.message.from,
        to: auth.message.to,
        value: req.maxAmountRequired,
        validAfter: auth.message.validAfter.toString(),
        validBefore: auth.message.validBefore.toString(),
        nonce: auth.message.nonce,
      },
    },
  }
  return btoa(JSON.stringify(payload))
}

export interface PaidVerifyResult {
  receipt: Receipt
  paymentTx?: string
}

/** Retry the verification with the signed payment header; return the paid receipt. */
export async function submitPaidVerify(
  credential: unknown,
  evidence: unknown,
  paymentHeader: string,
): Promise<PaidVerifyResult> {
  const res = await fetch(`${BASE}/api/v1/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-payment': paymentHeader },
    body: JSON.stringify({ credential, evidence }),
  })
  const text = await res.text()
  const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>
  if (res.status === 402) {
    throw new Error(String(body.error ?? 'Payment was rejected by the facilitator.'))
  }
  if (!res.ok) throw new Error(String(body.error ?? `Verify failed (${res.status}).`))

  let paymentTx: string | undefined
  const settle = res.headers.get('PAYMENT-RESPONSE')
  if (settle) {
    try {
      const decoded = JSON.parse(atob(settle)) as { transaction?: string }
      if (decoded.transaction) paymentTx = decoded.transaction
    } catch {
      /* header optional */
    }
  }
  return { receipt: body as unknown as Receipt, paymentTx }
}

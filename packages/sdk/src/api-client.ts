// REST API client (FR-4.8): verify(), issue(), getReceipt(), getIssuer() against
// a running Obsign API. `verify()` is x402-gated server-side; when unpaid, the
// client throws {@link X402PaymentRequiredError} carrying the challenge so a
// caller (or an agent) can pay and retry with the X-PAYMENT header.
//
// Network only crosses this boundary; the offline verifier (`verifyOffline`) needs
// no client at all. fetch is injectable so this stays runtime-agnostic and
// testable without a live server.

import type { Receipt } from '@obsign/core'

/** Minimal fetch surface (avoids depending on DOM/undici lib types). */
export type FetchLike = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export interface ObsignClientOptions {
  /** Base URL of the Obsign API, e.g. https://obsign.onrender.com */
  baseUrl: string
  /** Optional fetch implementation; defaults to the global fetch. */
  fetch?: FetchLike
  /** Optional bearer session token for issue() (SIWE session). */
  token?: string
}

/** The 402 challenge body returned when a verify request is unpaid. */
export interface X402Challenge {
  x402Version: number
  error: string
  accepts: unknown[]
}

/** Thrown by verify() when the server requires payment (HTTP 402). */
export class X402PaymentRequiredError extends Error {
  constructor(readonly challenge: X402Challenge) {
    super(challenge.error || 'payment required')
    this.name = 'X402PaymentRequiredError'
  }
}

/** Thrown for non-2xx, non-402 API responses. */
export class ObsignApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ObsignApiError'
  }
}

export interface VerifyOptions {
  /** A base64 X-PAYMENT header value obtained from an x402 payment flow. */
  payment?: string
  /** Optional verification instant to pin. */
  now?: string
}

export class ObsignClient {
  private readonly baseUrl: string
  private readonly doFetch: FetchLike
  private readonly token: string | undefined

  constructor(opts: ObsignClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.doFetch = opts.fetch ?? (globalThis.fetch as unknown as FetchLike)
    this.token = opts.token
  }

  /** Verify a credential + evidence server-side. Throws on 402 (pay + retry). */
  async verify(credential: unknown, evidence: unknown, opts: VerifyOptions = {}): Promise<Receipt> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (opts.payment) headers['x-payment'] = opts.payment
    const body: Record<string, unknown> = { credential, evidence }
    if (typeof opts.now === 'string') body.now = opts.now

    const res = await this.doFetch(`${this.baseUrl}/api/v1/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const text = await res.text()
    const parsed = (text ? JSON.parse(text) : {}) as Record<string, unknown>
    if (res.status === 402) {
      throw new X402PaymentRequiredError(parsed as unknown as X402Challenge)
    }
    if (!res.ok) {
      throw new ObsignApiError(res.status, String(parsed.error ?? `HTTP ${res.status}`))
    }
    return parsed as unknown as Receipt
  }

  /** Persist a self-signed credential + enqueue anchoring (requires a session token). */
  async issue(input: {
    credential: unknown
    evidence?: unknown
    issuerSignature: string
    txHash: string
  }): Promise<unknown> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.token) headers.authorization = `Bearer ${this.token}`
    return this.postJson(
      '/api/v1/credentials',
      {
        credential: input.credential,
        evidence: input.evidence ?? [],
        issuerSignature: input.issuerSignature,
        txHash: input.txHash,
      },
      headers,
    )
  }

  /** Fetch a cached receipt by receiptId. */
  async getReceipt(receiptId: string): Promise<unknown> {
    return this.getJson(`/api/v1/receipts/${encodeURIComponent(receiptId)}`)
  }

  /** Fetch a known issuer by address. */
  async getIssuer(address: string): Promise<unknown> {
    return this.getJson(`/api/v1/issuers/${encodeURIComponent(address)}`)
  }

  private async getJson(path: string): Promise<unknown> {
    const res = await this.doFetch(`${this.baseUrl}${path}`, { method: 'GET' })
    const text = await res.text()
    const parsed = text ? JSON.parse(text) : {}
    if (!res.ok) {
      throw new ObsignApiError(
        res.status,
        String((parsed as Record<string, unknown>).error ?? `HTTP ${res.status}`),
      )
    }
    return parsed
  }

  private async postJson(
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<unknown> {
    const res = await this.doFetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const text = await res.text()
    const parsed = text ? JSON.parse(text) : {}
    if (!res.ok) {
      throw new ObsignApiError(
        res.status,
        String((parsed as Record<string, unknown>).error ?? `HTTP ${res.status}`),
      )
    }
    return parsed
  }
}

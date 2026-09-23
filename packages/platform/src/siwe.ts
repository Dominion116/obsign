// Sign-In With Ethereum (EIP-4361) auth (P3-2 / SEC-2). The issuer proves control
// of their address by signing a one-time-nonce message; we mint a short-lived
// session JWT bound to that address. No issuer key material ever reaches the
// server (INV-7) — only a public signature.
//
// We use the `siwe` package to build/parse the EIP-4361 message and viem's
// `recoverMessageAddress` for offline signature recovery (viem is already the
// SDK's chain lib), then enforce domain, chain, nonce single-use, and validity
// window ourselves.

import { SiweMessage } from 'siwe'
import { recoverMessageAddress } from 'viem'
import { SignJWT, jwtVerify } from 'jose'
import type { Collection } from 'mongodb'
import type { SiweNonceDoc } from './types.js'

/** Thrown for any SIWE failure (bad domain/chain/nonce/signature/expiry). */
export class SiweVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SiweVerificationError'
  }
}

/** A verified session: the issuer address that signed in. */
export interface SiweSession {
  address: string
}

/** Nonce lifecycle: single-use, so a captured message cannot be replayed. */
export interface NonceStore {
  issue(now?: Date): Promise<string>
  /** Consume a nonce, returning true only the first time it is presented. */
  consume(nonce: string): Promise<boolean>
}

/** Mongo-backed nonce store (short-TTL collection; index expires stale nonces). */
export function createMongoNonceStore(col: Collection<SiweNonceDoc>): NonceStore {
  return {
    async issue(now = new Date()) {
      const nonce = randomNonce()
      await col.insertOne({ nonce, createdAt: now })
      return nonce
    },
    async consume(nonce) {
      const res = await col.deleteOne({ nonce })
      return res.deletedCount === 1
    },
  }
}

/** 17-char alphanumeric nonce (EIP-4361 requires >= 8 alphanumerics). */
function randomNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(17)
  globalThis.crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export interface SiweServiceOptions {
  nonces: NonceStore
  /** EIP-4361 domain (host[:port]) — from FRONTEND_ORIGIN. */
  domain: string
  /** EIP-4361 uri (full origin) — from FRONTEND_ORIGIN. */
  uri: string
  chainId: number
  /** HS256 signing secret for session JWTs. */
  jwtSecret: string
  sessionTtlSeconds?: number
}

export interface BuildMessageInput {
  address: string
  nonce: string
  issuedAt?: string
  statement?: string
}

const DEFAULT_SESSION_TTL_SECONDS = 3600

export class SiweService {
  private readonly secret: Uint8Array
  private readonly ttl: number

  constructor(private readonly opts: SiweServiceOptions) {
    this.secret = new TextEncoder().encode(opts.jwtSecret)
    this.ttl = opts.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS
  }

  /** Issue and persist a fresh nonce for a login attempt. */
  issueNonce(): Promise<string> {
    return this.opts.nonces.issue()
  }

  /** Build the canonical EIP-4361 message string a client should sign. */
  buildMessage(input: BuildMessageInput): string {
    const message = new SiweMessage({
      domain: this.opts.domain,
      address: input.address,
      uri: this.opts.uri,
      version: '1',
      chainId: this.opts.chainId,
      nonce: input.nonce,
      issuedAt: input.issuedAt ?? new Date().toISOString(),
      statement: input.statement ?? 'Sign in to Obsign.',
    })
    return message.prepareMessage()
  }

  /**
   * Verify a signed EIP-4361 message. Enforces domain, chainId, single-use
   * nonce, validity window, and signature recovery to the claimed address.
   * Throws {@link SiweVerificationError} on any failure.
   */
  async verify(
    params: { message: string; signature: string },
    now: Date = new Date(),
  ): Promise<SiweSession> {
    let parsed: SiweMessage
    try {
      parsed = new SiweMessage(params.message)
    } catch {
      throw new SiweVerificationError('Malformed EIP-4361 message')
    }

    if (parsed.domain !== this.opts.domain) {
      throw new SiweVerificationError('Unexpected SIWE domain')
    }
    if (parsed.chainId !== this.opts.chainId) {
      throw new SiweVerificationError('Unexpected SIWE chainId')
    }
    if (!parsed.nonce) {
      throw new SiweVerificationError('Missing SIWE nonce')
    }

    // Single-use: consume before verifying so a replayed message is rejected
    // even if the signature is otherwise valid.
    const fresh = await this.opts.nonces.consume(parsed.nonce)
    if (!fresh) {
      throw new SiweVerificationError('Unknown or replayed nonce')
    }

    const nowMs = now.getTime()
    if (parsed.expirationTime && nowMs > Date.parse(parsed.expirationTime)) {
      throw new SiweVerificationError('SIWE message expired')
    }
    if (parsed.notBefore && nowMs < Date.parse(parsed.notBefore)) {
      throw new SiweVerificationError('SIWE message not yet valid')
    }

    let recovered: string
    try {
      recovered = await recoverMessageAddress({
        message: params.message,
        signature: params.signature as `0x${string}`,
      })
    } catch {
      throw new SiweVerificationError('Invalid SIWE signature')
    }
    if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
      throw new SiweVerificationError('Invalid SIWE signature')
    }

    return { address: parsed.address.toLowerCase() }
  }

  /** Mint a session JWT bound to the issuer address (HS256). */
  async mintSession(address: string, now: Date = new Date()): Promise<string> {
    const iat = Math.floor(now.getTime() / 1000)
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(address.toLowerCase())
      .setIssuedAt(iat)
      .setExpirationTime(iat + this.ttl)
      .sign(this.secret)
  }

  /** Verify a session JWT and return the bound address. Throws when invalid. */
  async verifySession(token: string): Promise<SiweSession> {
    try {
      const { payload } = await jwtVerify(token, this.secret)
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new Error('missing sub')
      }
      return { address: payload.sub.toLowerCase() }
    } catch {
      throw new SiweVerificationError('Invalid or expired session')
    }
  }
}

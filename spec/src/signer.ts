// Deterministic secp256k1 signing for the golden-vector harness and the freeze
// tool. This is spec-workspace tooling — INV-1 (purity) applies to packages/core
// only, so signing lives here, not in the core. It reuses the core's keccak256 /
// sha256 primitives and produces EIP-191 personal-sign signatures that the core
// can recover, so fixtures verify for real (spec §5.1).
//
// Determinism: RFC 6979 nonce derivation + fixed per-seed private keys mean the
// same vector always yields the same signatures and the same receiptId.

import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  keccak256,
  sha256,
  utf8,
  type Hex,
} from '@obsign/core'

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n

function mod(a: bigint, m: bigint): bigint {
  const r = a % m
  return r < 0n ? r + m : r
}

function invMod(a: bigint, m: bigint): bigint {
  let [old_r, r] = [mod(a, m), m]
  let [old_s, s] = [1n, 0n]
  while (r !== 0n) {
    const q = old_r / r
    ;[old_r, r] = [r, old_r - q * r]
    ;[old_s, s] = [s, old_s - q * s]
  }
  return mod(old_s, m)
}

interface Jac {
  x: bigint
  y: bigint
  z: bigint
}
const ZERO: Jac = { x: 0n, y: 1n, z: 0n }

function dbl(p: Jac): Jac {
  if (p.y === 0n) return ZERO
  const ysq = mod(p.y * p.y, P)
  const S = mod(4n * p.x * ysq, P)
  const M = mod(3n * p.x * p.x, P)
  const nx = mod(M * M - 2n * S, P)
  const ny = mod(M * (S - nx) - 8n * ysq * ysq, P)
  const nz = mod(2n * p.y * p.z, P)
  return { x: nx, y: ny, z: nz }
}

function add(p1: Jac, p2: Jac): Jac {
  if (p1.z === 0n) return p2
  if (p2.z === 0n) return p1
  const z1z1 = mod(p1.z * p1.z, P)
  const z2z2 = mod(p2.z * p2.z, P)
  const u1 = mod(p1.x * z2z2, P)
  const u2 = mod(p2.x * z1z1, P)
  const s1 = mod(p1.y * p2.z * z2z2, P)
  const s2 = mod(p2.y * p1.z * z1z1, P)
  if (u1 === u2) {
    if (s1 !== s2) return ZERO
    return dbl(p1)
  }
  const h = mod(u2 - u1, P)
  const r = mod(s2 - s1, P)
  const hh = mod(h * h, P)
  const hhh = mod(h * hh, P)
  const u1hh = mod(u1 * hh, P)
  const nx = mod(r * r - hhh - 2n * u1hh, P)
  const ny = mod(r * (u1hh - nx) - s1 * hhh, P)
  const nz = mod(h * p1.z * p2.z, P)
  return { x: nx, y: ny, z: nz }
}

function mul(p: Jac, k: bigint): Jac {
  let result = ZERO
  let addend = p
  let n = mod(k, N)
  while (n > 0n) {
    if (n & 1n) result = add(result, addend)
    addend = dbl(addend)
    n >>= 1n
  }
  return result
}

function toAffine(p: Jac): { x: bigint; y: bigint } {
  const zinv = invMod(p.z, P)
  const zinv2 = mod(zinv * zinv, P)
  const zinv3 = mod(zinv2 * zinv, P)
  return { x: mod(p.x * zinv2, P), y: mod(p.y * zinv3, P) }
}

function bytesToBig(bytes: Uint8Array): bigint {
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  return n
}

function bigTo32(n: bigint): Uint8Array {
  const out = new Uint8Array(32)
  let v = n
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

// --- HMAC-SHA256 (for RFC 6979) -------------------------------------------

function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const block = 64
  let k = key
  if (k.length > block) k = sha256(k)
  const padded = new Uint8Array(block)
  padded.set(k)
  const ipad = new Uint8Array(block)
  const opad = new Uint8Array(block)
  for (let i = 0; i < block; i++) {
    ipad[i] = padded[i] ^ 0x36
    opad[i] = padded[i] ^ 0x5c
  }
  const inner = sha256(concatBytes(ipad, msg))
  return sha256(concatBytes(opad, inner))
}

// RFC 6979 deterministic nonce.
function rfc6979k(privKey: Uint8Array, h1: Uint8Array): bigint {
  const z = mod(bytesToBig(h1), N)
  const zOctets = bigTo32(z)
  let v = new Uint8Array(32).fill(0x01)
  let k = new Uint8Array(32).fill(0x00)
  k = hmacSha256(k, concatBytes(v, Uint8Array.of(0x00), privKey, zOctets))
  v = hmacSha256(k, v)
  k = hmacSha256(k, concatBytes(v, Uint8Array.of(0x01), privKey, zOctets))
  v = hmacSha256(k, v)
  for (;;) {
    v = hmacSha256(k, v)
    const cand = bytesToBig(v)
    if (cand >= 1n && cand < N) return cand
    k = hmacSha256(k, concatBytes(v, Uint8Array.of(0x00)))
    v = hmacSha256(k, v)
  }
}

/** The uncompressed 64-byte public key (x||y) for a private scalar. */
export function publicKey(priv: bigint): Uint8Array {
  const aff = toAffine(mul({ x: GX, y: GY, z: 1n }, priv))
  return concatBytes(bigTo32(aff.x), bigTo32(aff.y))
}

/** The 20-byte address for a private scalar. */
export function addressFromPrivate(priv: bigint): Hex {
  const hash = keccak256(publicKey(priv))
  return bytesToHex(hash.slice(12))
}

/**
 * ECDSA-sign a 32-byte digest with a private scalar. Returns a 65-byte
 * `r||s||v` signature (low-s, v in {27,28}).
 */
export function signDigest(priv: bigint, digest: Uint8Array): Hex {
  const k = rfc6979k(bigTo32(priv), digest)
  const R = toAffine(mul({ x: GX, y: GY, z: 1n }, k))
  const r = mod(R.x, N)
  if (r === 0n) throw new Error('signDigest: r=0, unlucky nonce')
  const e = mod(bytesToBig(digest), N)
  const kInv = invMod(k, N)
  let s = mod(kInv * (e + r * priv), N)
  let recovery = (R.y & 1n) === 1n ? 1 : 0
  if (R.x >= N) recovery |= 2
  // Enforce low-s (Ethereum canonical form) and flip parity if we negate s.
  if (s > N / 2n) {
    s = N - s
    recovery ^= 1
  }
  const v = 27 + (recovery & 1)
  return bytesToHex(concatBytes(bigTo32(r), bigTo32(s), Uint8Array.of(v)))
}

/**
 * EIP-191 personal-sign over a raw message payload, matching the core's
 * hashPersonalMessage / recoverPersonalAddress.
 */
export function personalSign(priv: bigint, message: Uint8Array): Hex {
  const prefix = utf8(`\x19Ethereum Signed Message:\n${message.length}`)
  const digest = keccak256(concatBytes(prefix, message))
  return signDigest(priv, digest)
}

/**
 * Deterministic private scalar for a fixture "seed" (typically the placeholder
 * signer address). Stable across runs and platforms.
 */
export function fixtureKey(seed: string): bigint {
  const h = bytesToBig(keccak256(utf8(`obsign-fixture:${seed.toLowerCase()}`)))
  const k = mod(h, N - 1n) + 1n
  return k
}

/** Sign `messageHash` (hex) as the fixture signer for `seed`. */
export function fixtureSign(seed: string, messageHash: string): { address: Hex; signature: Hex } {
  const priv = fixtureKey(seed)
  return {
    address: addressFromPrivate(priv),
    signature: personalSign(priv, hexToBytes(messageHash)),
  }
}

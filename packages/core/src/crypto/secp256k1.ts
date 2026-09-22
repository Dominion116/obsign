// Dependency-free secp256k1 ECDSA public-key recovery. The reference verifier
// only needs to *recover* a signer address from a signature over a 32-byte
// digest (EIP-191); it never signs. Signing (for fixture generation) lives
// outside the pure core.
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

// Field prime p and curve order n for secp256k1: y^2 = x^3 + 7.
const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const A = 0n
const B = 7n
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n

function mod(a: bigint, m: bigint): bigint {
  const r = a % m
  return r < 0n ? r + m : r
}

/** Modular inverse via extended Euclidean algorithm. */
function invMod(a: bigint, m: bigint): bigint {
  let [old_r, r] = [mod(a, m), m]
  let [old_s, s] = [1n, 0n]
  while (r !== 0n) {
    const q = old_r / r
    ;[old_r, r] = [r, old_r - q * r]
    ;[old_s, s] = [s, old_s - q * s]
  }
  if (old_r !== 1n) throw new Error('secp256k1: value not invertible')
  return mod(old_s, m)
}

/** Modular exponentiation. */
function powMod(base: bigint, exp: bigint, m: bigint): bigint {
  let result = 1n
  let b = mod(base, m)
  let e = exp
  while (e > 0n) {
    if (e & 1n) result = mod(result * b, m)
    b = mod(b * b, m)
    e >>= 1n
  }
  return result
}

// Jacobian point arithmetic to avoid per-op inversions.
interface Jacobian {
  x: bigint
  y: bigint
  z: bigint
}

const ZERO: Jacobian = { x: 0n, y: 1n, z: 0n }

function jacobianDouble(pt: Jacobian): Jacobian {
  const { x, y, z } = pt
  if (y === 0n) return ZERO
  const ysq = mod(y * y, P)
  const S = mod(4n * x * ysq, P)
  const M = mod(3n * x * x + A * mod(z * z, P) * mod(z * z, P), P)
  const nx = mod(M * M - 2n * S, P)
  const ny = mod(M * (S - nx) - 8n * ysq * ysq, P)
  const nz = mod(2n * y * z, P)
  return { x: nx, y: ny, z: nz }
}

function jacobianAdd(p1: Jacobian, p2: Jacobian): Jacobian {
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
    return jacobianDouble(p1)
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

function jacobianMul(pt: Jacobian, k: bigint): Jacobian {
  let result = ZERO
  let addend = pt
  let n = mod(k, N)
  while (n > 0n) {
    if (n & 1n) result = jacobianAdd(result, addend)
    addend = jacobianDouble(addend)
    n >>= 1n
  }
  return result
}

function toAffine(pt: Jacobian): { x: bigint; y: bigint } | null {
  if (pt.z === 0n) return null
  const zinv = invMod(pt.z, P)
  const zinv2 = mod(zinv * zinv, P)
  const zinv3 = mod(zinv2 * zinv, P)
  return { x: mod(pt.x * zinv2, P), y: mod(pt.y * zinv3, P) }
}

/**
 * Recover the 64-byte uncompressed public key (x||y, no prefix) from an ECDSA
 * signature over `msgHash` (32 bytes). `recovery` is 0 or 1 (the low bit of the
 * y-parity, as encoded by `v = 27 + recovery`). Returns null on failure.
 */
export function recoverPublicKey(
  msgHash: Uint8Array,
  r: bigint,
  s: bigint,
  recovery: number,
): Uint8Array | null {
  if (r <= 0n || r >= N || s <= 0n || s >= N) return null
  if (recovery !== 0 && recovery !== 1) return null

  // x-coordinate of R. (We do not support r >= p - n wraparound, recovery bit 2/3.)
  const x = r
  // Recover y from the curve equation: y^2 = x^3 + 7.
  const ySq = mod(x * x * x + A * x + B, P)
  // p % 4 == 3, so sqrt = a^((p+1)/4).
  let y = powMod(ySq, (P + 1n) / 4n, P)
  // Confirm it is a real square root.
  if (mod(y * y, P) !== ySq) return null
  // Choose y with parity matching the recovery bit.
  const isYOdd = (y & 1n) === 1n
  if (isYOdd !== (recovery === 1)) {
    y = mod(P - y, P)
  }

  const e = mod(bytesToBigInt(msgHash), N)
  const rInv = invMod(r, N)

  const R: Jacobian = { x, y, z: 1n }
  // Q = r^-1 * (s*R - e*G)
  const sR = jacobianMul(R, s)
  const eG = jacobianMul({ x: GX, y: GY, z: 1n }, e)
  // -eG: negate y.
  const negEG: Jacobian = { x: eG.x, y: mod(P - eG.y, P), z: eG.z }
  const sum = jacobianAdd(sR, negEG)
  const Q = jacobianMul(sum, rInv)
  const aff = toAffine(Q)
  if (!aff) return null

  const out = new Uint8Array(64)
  bigIntTo32(aff.x, out, 0)
  bigIntTo32(aff.y, out, 32)
  return out
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  return n
}

function bigIntTo32(n: bigint, out: Uint8Array, offset: number): void {
  for (let i = 31; i >= 0; i--) {
    out[offset + i] = Number(n & 0xffn)
    n >>= 8n
  }
}

export { N as SECP256K1_N, P as SECP256K1_P, bytesToBigInt }

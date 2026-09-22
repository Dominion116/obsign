// Dependency-free Keccak-256 (Ethereum SHA3 variant, 0x01 padding).
//
// This is the single source of truth for keccak-256 (spec/receipt.md §3); the
// web demo re-imports the concept but packages/core is authoritative.
//
// Uses the canonical in-place Keccak-f[1600] permutation (standard RHO/PI lane
// schedule) so outputs match every conforming implementation byte-for-byte.
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

const RC: bigint[] = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
]

// Lane rotation offsets and destination indices for the combined ρ/π step,
// iterating lanes 1..24 (lane 0 is fixed).
const RHO = [
  1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
]
const PI = [
  10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
]

const MASK64 = 0xffffffffffffffffn

function rotl64(x: bigint, n: number): bigint {
  const b = BigInt(n)
  return ((x << b) | (x >> (64n - b))) & MASK64
}

function keccakF(s: bigint[]): void {
  const C = new Array<bigint>(5)
  for (let round = 0; round < 24; round++) {
    // θ (theta)
    for (let x = 0; x < 5; x++) {
      C[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]
    }
    for (let x = 0; x < 5; x++) {
      const d = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1)
      for (let y = 0; y < 25; y += 5) {
        s[x + y] ^= d
      }
    }

    // ρ (rho) and π (pi) combined, walking lanes 1..24.
    let last = s[1]
    for (let x = 0; x < 24; x++) {
      const j = PI[x]
      const tmp = s[j]
      s[j] = rotl64(last, RHO[x])
      last = tmp
    }

    // χ (chi)
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) C[x] = s[y + x]
      for (let x = 0; x < 5; x++) {
        s[y + x] = C[x] ^ (~C[(x + 1) % 5] & C[(x + 2) % 5] & MASK64)
      }
    }

    // ι (iota)
    s[0] ^= RC[round]
  }
}

/** Keccak-256 digest of the input bytes (32-byte Uint8Array). */
export function keccak256(bytes: Uint8Array): Uint8Array {
  const rate = 136 // 1088-bit rate for Keccak-256
  const state = new Array<bigint>(25).fill(0n)

  const laneBytes = new Uint8Array(8)
  const laneView = new DataView(laneBytes.buffer)

  const absorb = (block: Uint8Array): void => {
    for (let i = 0; i < rate / 8; i++) {
      laneBytes.fill(0)
      for (let j = 0; j < 8; j++) {
        laneBytes[j] = block[i * 8 + j] ?? 0
      }
      state[i] ^= laneView.getBigUint64(0, true)
    }
    keccakF(state)
  }

  const full = Math.floor(bytes.length / rate)
  for (let i = 0; i < full; i++) {
    absorb(bytes.subarray(i * rate, (i + 1) * rate))
  }

  const last = bytes.subarray(full * rate)
  const padded = new Uint8Array(rate)
  padded.set(last)
  padded[last.length] = 0x01
  padded[rate - 1] |= 0x80
  absorb(padded)

  const out = new Uint8Array(32)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) {
      out[i * 8 + j] = Number((state[i] >> BigInt(8 * j)) & 0xffn)
    }
  }
  return out
}

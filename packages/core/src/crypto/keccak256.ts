// Dependency-free Keccak-256 (Ethereum SHA3 variant, 0x01 padding).
//
// Ported from apps/web/src/lib/keccak.ts into the shared pure core. This is the
// single source of truth for keccak-256; the web demo re-imports the concept but
// packages/core is authoritative (spec/receipt.md §3).
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

const ROT: number[][] = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
]

const PI: number[][] = [
  [0, 3, 1, 4, 2],
  [1, 4, 2, 0, 3],
  [2, 0, 3, 1, 4],
  [3, 1, 4, 2, 0],
  [4, 2, 0, 3, 1],
]

const MASK64 = 0xffffffffffffffffn

function rotl64(x: bigint, n: number): bigint {
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64
}

function keccakF(a: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    const C = new Array<bigint>(5)
    const D = new Array<bigint>(5)
    for (let x = 0; x < 5; x++) {
      C[x] = a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20]
    }
    for (let x = 0; x < 5; x++) {
      D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1)
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        a[x + 5 * y] ^= D[x]
      }
    }

    const b = new Array<bigint>(25)
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const ny = PI[x][y]
        const nx = (x + y) % 5
        const v = a[x + 5 * y]
        b[ny + 5 * nx] = rotl64(v, ROT[y][x])
      }
    }

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const i = x + 5 * y
        a[i] = b[i] ^ (~b[((x + 1) % 5) + 5 * y] & b[((x + 2) % 5) + 5 * y])
      }
    }
    a[0] ^= RC[round]
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
      const lane = laneView.getBigUint64(0, true)
      state[i] ^= lane
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

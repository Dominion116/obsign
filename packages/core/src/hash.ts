// Byte/hex encoding helpers plus the two digest wrappers used across the core.
// A hand-rolled UTF-8 encoder keeps the module free of the TextEncoder global so
// the pure core needs no DOM/Node lib typings and behaves identically on every
// platform (INV-2 cross-process determinism).
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

import { keccak256 } from './crypto/keccak256.js'
import { sha256 } from './crypto/sha256.js'

export type Hex = `0x${string}`

/** Deterministic UTF-8 encoding of a string, including surrogate-pair handling. */
export function utf8(input: string): Uint8Array {
  const out: number[] = []
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
        i++
      }
    }
    if (code < 0x80) {
      out.push(code)
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }
  return Uint8Array.from(out)
}

const HEX = '0123456789abcdef'

/** Lowercase `0x`-prefixed hex for the given bytes. */
export function bytesToHex(bytes: Uint8Array): Hex {
  let s = '0x'
  for (const b of bytes) s += HEX[b >> 4] + HEX[b & 0x0f]
  return s as Hex
}

/** Parse `0x`-prefixed (or bare) hex into bytes. Throws on malformed input. */
export function hexToBytes(hex: string): Uint8Array {
  let h = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
  if (h.length % 2 !== 0) h = '0' + h
  if (!/^[0-9a-fA-F]*$/.test(h)) throw new Error(`invalid hex: ${hex}`)
  const out = new Uint8Array(h.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/** True when `s` is a `0x`-prefixed even-length lowercase-or-mixed hex string. */
export function isHex(s: unknown): s is Hex {
  return typeof s === 'string' && /^0x([0-9a-fA-F]{2})*$/.test(s)
}

/** Concatenate byte arrays into one. */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(len)
  let off = 0
  for (const a of arrays) {
    out.set(a, off)
    off += a.length
  }
  return out
}

export { keccak256, sha256 }

/** keccak256 rendered as `0x` + 64 lowercase hex chars. */
export function keccak256Hex(bytes: Uint8Array): Hex {
  return bytesToHex(keccak256(bytes))
}

/** sha256 rendered as `0x` + 64 lowercase hex chars. */
export function sha256Hex(bytes: Uint8Array): Hex {
  return bytesToHex(sha256(bytes))
}

// EIP-191 personal-sign verification helpers.
//
// Quorum signers (spec §5.1) sign the 32-byte message hash with a personal_sign
// prefix. This module derives the EIP-191 digest, recovers the signer, and
// exposes address helpers. Signing itself is out of scope for the pure core.
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

import { bytesToHex, concatBytes, hexToBytes, keccak256, utf8, type Hex } from './hash.js'
import { recoverPublicKey, bytesToBigInt } from './crypto/secp256k1.js'

/**
 * EIP-191 personal_sign digest over an arbitrary message payload:
 *   keccak256("\x19Ethereum Signed Message:\n" + len + message)
 */
export function hashPersonalMessage(message: Uint8Array): Uint8Array {
  const prefix = utf8(`\x19Ethereum Signed Message:\n${message.length}`)
  return keccak256(concatBytes(prefix, message))
}

/** The 20-byte Ethereum address for an uncompressed 64-byte public key. */
export function publicKeyToAddress(pubKey64: Uint8Array): Hex {
  const hash = keccak256(pubKey64)
  return bytesToHex(hash.slice(12)) // last 20 bytes
}

export interface ParsedSignature {
  r: bigint
  s: bigint
  recovery: number
}

/** Parse a 65-byte `0x` signature (r||s||v) into components. Null when malformed. */
export function parseSignature(signature: string): ParsedSignature | null {
  let bytes: Uint8Array
  try {
    bytes = hexToBytes(signature)
  } catch {
    return null
  }
  if (bytes.length !== 65) return null
  const r = bytesToBigInt(bytes.slice(0, 32))
  const s = bytesToBigInt(bytes.slice(32, 64))
  let v = bytes[64]
  if (v >= 27) v -= 27
  if (v !== 0 && v !== 1) return null
  return { r, s, recovery: v }
}

/**
 * Recover the signer address for a personal_sign signature over `message`.
 * Returns a lowercase `0x` address, or null when the signature is malformed or
 * unrecoverable.
 */
export function recoverPersonalAddress(message: Uint8Array, signature: string): Hex | null {
  const parsed = parseSignature(signature)
  if (!parsed) return null
  const digest = hashPersonalMessage(message)
  const pub = recoverPublicKey(digest, parsed.r, parsed.s, parsed.recovery)
  if (!pub) return null
  return publicKeyToAddress(pub)
}

/** Case-insensitive address equality (both sides normalized to lowercase). */
export function addressEquals(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

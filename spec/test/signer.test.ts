import { describe, expect, it } from 'vitest'
import { bytesToHex, hexToBytes, keccak256, recoverPersonalAddress } from '@obsign/core'
import { addressFromPrivate, fixtureKey, personalSign, publicKey } from '../src/signer.js'

// Round-trips the tooling signer against the core's recovery path. If these two
// implementations ever diverge, valid golden vectors stop verifying — this test
// pins the contract directly.

const MESSAGE = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

describe('signer ↔ core recovery round-trip', () => {
  it('recovers the signing address from a personal_sign signature', () => {
    const priv = fixtureKey('roundtrip-a')
    const addr = addressFromPrivate(priv)
    const message = hexToBytes(MESSAGE)
    const sig = personalSign(priv, message)
    expect(recoverPersonalAddress(message, sig)).toBe(addr)
  })

  it('derives the same address via public key hashing', () => {
    const priv = fixtureKey('roundtrip-b')
    const addr = bytesToHex(keccak256(publicKey(priv)).slice(12))
    expect(addr).toBe(addressFromPrivate(priv))
  })

  it('recovers distinct addresses for distinct seeds', () => {
    const a = addressFromPrivate(fixtureKey('seed-1'))
    const b = addressFromPrivate(fixtureKey('seed-2'))
    expect(a).not.toBe(b)
  })

  it('produces a 65-byte signature with a canonical v', () => {
    const priv = fixtureKey('roundtrip-c')
    const sig = personalSign(priv, hexToBytes(MESSAGE))
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/)
    const v = parseInt(sig.slice(130, 132), 16)
    expect([27, 28]).toContain(v)
  })
})

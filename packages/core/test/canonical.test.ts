import { describe, expect, it } from 'vitest'
import { canonicalize, canonicalBytes } from '../src/canonical.js'
import { bytesToHex, keccak256, sha256, utf8 } from '../src/hash.js'

describe('canonicalize (RFC 8785 / JCS)', () => {
  it('sorts object keys by UTF-16 code-unit order', () => {
    expect(canonicalize({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}')
  })

  it('is invariant under key reordering', () => {
    const a = canonicalize({ x: 1, y: 2, z: { m: 3, n: 4 } })
    const b = canonicalize({ z: { n: 4, m: 3 }, y: 2, x: 1 })
    expect(a).toBe(b)
  })

  it('preserves array element order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]')
  })

  it('drops undefined object members and stringifies nested values', () => {
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}')
  })

  it('serializes literals verbatim', () => {
    expect(canonicalize({ t: true, f: false, n: null })).toBe('{"f":false,"n":null,"t":true}')
  })

  it('emits integers without decimal point or exponent', () => {
    expect(canonicalize({ n: 12345678 })).toBe('{"n":12345678}')
  })

  it('escapes strings per JSON minimal rules', () => {
    expect(canonicalize('a"b\\c')).toBe('"a\\"b\\\\c"')
  })

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize(NaN)).toThrow()
    expect(() => canonicalize(Infinity)).toThrow()
  })
})

describe('hashing property: reorder vs byte flip', () => {
  const credential = {
    v: 1,
    credentialId: '0xabc',
    issuer: '0x1111111111111111111111111111111111111111',
    subject: '0x2222222222222222222222222222222222222222',
    claim: { type: 'attendance', context: 'ctx', details: {} },
    evidenceRefs: ['0x01'],
    issuedAt: '2026-09-13T00:00:00.000Z',
    validFrom: '2026-09-13T00:00:00.000Z',
    validUntil: '2027-09-13T00:00:00.000Z',
    nonce: '0x0a',
  }

  it('produces the same hash when keys are reordered', () => {
    const reordered = {
      nonce: '0x0a',
      validUntil: '2027-09-13T00:00:00.000Z',
      validFrom: '2026-09-13T00:00:00.000Z',
      issuedAt: '2026-09-13T00:00:00.000Z',
      evidenceRefs: ['0x01'],
      claim: { details: {}, context: 'ctx', type: 'attendance' },
      subject: '0x2222222222222222222222222222222222222222',
      issuer: '0x1111111111111111111111111111111111111111',
      credentialId: '0xabc',
      v: 1,
    }
    const h1 = bytesToHex(keccak256(canonicalBytes(credential)))
    const h2 = bytesToHex(keccak256(canonicalBytes(reordered)))
    expect(h1).toBe(h2)
  })

  it('changes the hash when a single byte flips', () => {
    const flipped = { ...credential, subject: credential.subject.replace(/2$/, '3') }
    const h1 = bytesToHex(keccak256(canonicalBytes(credential)))
    const h2 = bytesToHex(keccak256(canonicalBytes(flipped)))
    expect(h1).not.toBe(h2)
  })
})

describe('digest known-answer vectors', () => {
  it('keccak256 of empty input', () => {
    expect(bytesToHex(keccak256(new Uint8Array(0)))).toBe(
      '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    )
  })

  it('keccak256 of "abc"', () => {
    expect(bytesToHex(keccak256(utf8('abc')))).toBe(
      '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
    )
  })

  it('sha256 of "abc"', () => {
    expect(bytesToHex(sha256(utf8('abc')))).toBe(
      '0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('sha256 of empty input', () => {
    expect(bytesToHex(sha256(new Uint8Array(0)))).toBe(
      '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('sha256 of "test"', () => {
    expect(bytesToHex(sha256(utf8('test')))).toBe(
      '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    )
  })
})

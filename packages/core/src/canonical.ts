// RFC 8785 (JSON Canonicalization Scheme, JCS) serialization.
//
// This is the single source of truth for canonicalization (spec/receipt.md §2);
// it is also consumed by the web app through @obsign/core.
//
// The output is locale- and platform-independent:
//   - object members are sorted by key in UTF-16 code-unit order,
//   - arrays preserve element order,
//   - strings use ECMAScript/RFC 8785 minimal escaping (JSON.stringify already
//     produces exactly this: quote, backslash, and control chars < 0x20 escaped,
//     lone surrogates as \uXXXX, everything else verbatim),
//   - numbers use ECMAScript shortest round-trip (JSON.stringify),
//   - literals true/false/null verbatim.
//
// Pure per INV-1: no clock, network, filesystem, or randomness.

import { utf8 } from './hash.js'

export class CanonicalizationError extends Error {}

/** Produce the canonical JCS string for a JSON value. */
export function canonicalize(value: unknown): string {
  const out: string[] = []
  writeValue(value, out)
  return out.join('')
}

/** Canonical UTF-8 bytes for a JSON value. */
export function canonicalBytes(value: unknown): Uint8Array {
  return utf8(canonicalize(value))
}

function writeValue(value: unknown, out: string[]): void {
  if (value === null) {
    out.push('null')
    return
  }
  const t = typeof value
  if (t === 'string') {
    out.push(JSON.stringify(value))
    return
  }
  if (t === 'boolean') {
    out.push(value ? 'true' : 'false')
    return
  }
  if (t === 'number') {
    writeNumber(value as number, out)
    return
  }
  if (t === 'bigint') {
    // BigInt is outside the JSON data model; the spec's integers arrive as
    // Number. Reject rather than guess a serialization.
    throw new CanonicalizationError('cannot canonicalize a bigint value')
  }
  if (Array.isArray(value)) {
    writeArray(value, out)
    return
  }
  if (t === 'object') {
    writeObject(value as Record<string, unknown>, out)
    return
  }
  // undefined, function, symbol: not representable.
  throw new CanonicalizationError(`cannot canonicalize value of type ${t}`)
}

function writeNumber(n: number, out: string[]): void {
  if (!Number.isFinite(n)) {
    throw new CanonicalizationError('cannot canonicalize a non-finite number')
  }
  // JSON.stringify yields the ECMAScript shortest round-trip form, which is what
  // RFC 8785 §3.2.2.3 mandates. Integers therefore have no decimal point or
  // exponent within the safe range used by this spec.
  out.push(JSON.stringify(n))
}

function writeArray(arr: unknown[], out: string[]): void {
  out.push('[')
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) out.push(',')
    const el = arr[i]
    // Array holes / undefined serialize to null in JSON; mirror that.
    if (el === undefined) {
      out.push('null')
    } else {
      writeValue(el, out)
    }
  }
  out.push(']')
}

function writeObject(obj: Record<string, unknown>, out: string[]): void {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined)
  // Sort by UTF-16 code-unit order (default string comparison in JS).
  keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  out.push('{')
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) out.push(',')
    out.push(JSON.stringify(keys[i]))
    out.push(':')
    writeValue(obj[keys[i]], out)
  }
  out.push('}')
}

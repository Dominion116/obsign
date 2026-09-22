// Injected read interfaces (Phase 1 defines the shapes; live implementations
// land in Phase 2/3). The pure verifier consumes these synchronously over a
// pre-pinned snapshot — it never performs I/O itself (INV-1, INV-6).
//
// The fixture builders below construct readers from the plain-object shapes used
// by the golden-vector `context` (spec/src/types.ts VectorContext), so tests and
// the CLI can inject fixtures without bespoke glue.

import { addressEquals } from './eip191.js'

/** A pinned block header, as returned by a ChainReader. */
export interface BlockHeader {
  hash: string
  number: number
  confirmations: number
}

/** A single event log at a fixed (txHash, logIndex) coordinate. */
export interface EventLog {
  txHash: string
  logIndex: number
  address: string
  topics: string[]
  data: string
}

/**
 * Pinned-read chain access (INV-6). All reads are addressed by a specific block
 * / tx coordinate — never `latest`. A reader models a fixed snapshot; absence of
 * a reader means the chain is unavailable (fail closed → CHAIN_UNAVAILABLE).
 */
export interface ChainReader {
  getBlock(blockNumber: number): BlockHeader | null
  getLog(txHash: string, logIndex: number): EventLog | null
  isRevoked(credentialId: string): boolean
}

/** Byte store for artifact evidence. Returns null when the uri is unreachable. */
export interface EvidenceStore {
  get(uri: string): Uint8Array | null
}

/** Issuer registry (optional in Phase 1). */
export interface IssuerRecord {
  active: boolean
}

export interface IssuerRegistry {
  getIssuer(address: string): IssuerRecord | null
}

// ---------------------------------------------------------------------------
// Fixture builders (align to the VectorContext plain-object shape).
// ---------------------------------------------------------------------------

/** Plain-object chain fixture matching VectorContext.chain. */
export interface ChainFixture {
  blocks?: Record<string, { hash: string; number: number; confirmations: number }>
  logs?: Array<{
    txHash?: string
    logIndex?: number
    address?: string
    topics?: string[]
    data?: string
    [k: string]: unknown
  }>
  revoked?: string[]
}

/** Build a ChainReader over a plain fixture object. */
export function chainReaderFromFixture(fixture: ChainFixture | undefined): ChainReader {
  const blocks = fixture?.blocks ?? {}
  const logs = fixture?.logs ?? []
  const revoked = fixture?.revoked ?? []
  return {
    getBlock(blockNumber: number): BlockHeader | null {
      const b = blocks[String(blockNumber)]
      if (!b) return null
      return { hash: b.hash, number: b.number, confirmations: b.confirmations }
    },
    getLog(txHash: string, logIndex: number): EventLog | null {
      for (const log of logs) {
        if (log.txHash === txHash && log.logIndex === logIndex) {
          return {
            txHash: String(log.txHash),
            logIndex: Number(log.logIndex),
            address: String(log.address ?? ''),
            topics: Array.isArray(log.topics) ? (log.topics as string[]) : [],
            data: String(log.data ?? '0x'),
          }
        }
      }
      return null
    },
    isRevoked(credentialId: string): boolean {
      return revoked.some((r) => addressEquals(r, credentialId))
    },
  }
}

/** Plain-object artifact fixture: uri -> bytes (as hex or utf8 text). */
export type ArtifactFixture = Record<string, { hex?: string; utf8?: string }>

/** Build an EvidenceStore over a plain fixture object. */
export function evidenceStoreFromFixture(fixture: ArtifactFixture | undefined): EvidenceStore {
  const map = fixture ?? {}
  return {
    get(uri: string): Uint8Array | null {
      const entry = map[uri]
      if (!entry) return null
      if (typeof entry.hex === 'string') {
        const h = entry.hex.startsWith('0x') ? entry.hex.slice(2) : entry.hex
        const out = new Uint8Array(h.length / 2)
        for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
        return out
      }
      if (typeof entry.utf8 === 'string') {
        // Local UTF-8 encoding (ASCII-safe for fixtures); avoids TextEncoder dep.
        const s = entry.utf8
        const bytes: number[] = []
        for (let i = 0; i < s.length; i++) {
          const c = s.charCodeAt(i)
          if (c < 0x80) bytes.push(c)
          else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
          else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
        }
        return Uint8Array.from(bytes)
      }
      return null
    },
  }
}

/** Build an IssuerRegistry over a plain map. */
export function issuerRegistryFromFixture(
  fixture: Record<string, { active: boolean }> | undefined,
): IssuerRegistry | undefined {
  if (!fixture) return undefined
  return {
    getIssuer(address: string): IssuerRecord | null {
      const key = Object.keys(fixture).find((k) => addressEquals(k, address))
      return key ? fixture[key] : null
    },
  }
}

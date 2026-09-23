// Typed repositories over the cache collections. Each repo is a thin, testable
// wrapper that owns the read/write shapes for one collection and stamps
// timestamps. All writes are idempotent-friendly (upserts keyed by the natural
// unique key) so a replayed job never double-writes (INV-4).

import type { Db } from 'mongodb'
import { collections, type Collections } from '../mongo.js'
import type {
  AnchorDoc,
  AuditDoc,
  CredentialDoc,
  CredentialStatus,
  IssuerDoc,
  ReceiptDoc,
  RevocationDoc,
} from '../types.js'

function nowIso(): string {
  return new Date().toISOString()
}

/** Drop keys whose value is `undefined` (keeps exactOptionalPropertyTypes happy). */
function defined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out as { [K in keyof T]?: Exclude<T[K], undefined> }
}

export interface IssuerRepo {
  get(address: string): Promise<IssuerDoc | null>
  upsert(address: string, patch: Partial<Omit<IssuerDoc, 'address' | 'createdAt'>>): Promise<void>
  touchLogin(address: string): Promise<void>
}

export interface CredentialRepo {
  get(credentialId: string): Promise<CredentialDoc | null>
  getByReceiptId(receiptId: string): Promise<CredentialDoc | null>
  listByIssuer(issuer: string): Promise<CredentialDoc[]>
  /** Insert a new credential. Throws on duplicate credentialId/receiptId. */
  insert(doc: Omit<CredentialDoc, 'createdAt' | 'updatedAt'>): Promise<void>
  setStatus(credentialId: string, status: CredentialStatus): Promise<void>
}

export interface ReceiptRepo {
  get(receiptId: string): Promise<ReceiptDoc | null>
  upsert(doc: Omit<ReceiptDoc, 'updatedAt'>): Promise<void>
}

export interface AnchorUpsert {
  credentialId: string
  receiptId: string
  txHash: string
  blockNumber?: number | undefined
  blockHash?: string | undefined
  confirmations: number
  confirmed: boolean
}

export interface RevocationUpsert {
  credentialId: string
  issuer: string
  txHash: string
  blockNumber?: number | undefined
  confirmations: number
  confirmed: boolean
}

export interface AnchorRepo {
  get(credentialId: string): Promise<AnchorDoc | null>
  upsert(doc: AnchorUpsert): Promise<void>
}

export interface RevocationRepo {
  get(credentialId: string): Promise<RevocationDoc | null>
  upsert(doc: RevocationUpsert): Promise<void>
}

export interface AuditRepo {
  append(entry: Omit<AuditDoc, 'at'> & { at?: string }): Promise<void>
}

export interface Repositories {
  issuers: IssuerRepo
  credentials: CredentialRepo
  receipts: ReceiptRepo
  anchors: AnchorRepo
  revocations: RevocationRepo
  audit: AuditRepo
}

function issuerRepo(c: Collections): IssuerRepo {
  return {
    async get(address) {
      return c.issuers.findOne({ address: address.toLowerCase() })
    },
    async upsert(address, patch) {
      const now = nowIso()
      await c.issuers.updateOne(
        { address: address.toLowerCase() },
        {
          $set: { ...defined(patch), updatedAt: now },
          $setOnInsert: { address: address.toLowerCase(), createdAt: now },
        },
        { upsert: true },
      )
    },
    async touchLogin(address) {
      await this.upsert(address, { lastLoginAt: nowIso() })
    },
  }
}

function credentialRepo(c: Collections): CredentialRepo {
  return {
    async get(credentialId) {
      return c.credentials.findOne({ credentialId })
    },
    async getByReceiptId(receiptId) {
      return c.credentials.findOne({ receiptId })
    },
    async listByIssuer(issuer) {
      return c.credentials.find({ issuer: issuer.toLowerCase() }).sort({ createdAt: -1 }).toArray()
    },
    async insert(doc) {
      const now = nowIso()
      await c.credentials.insertOne({
        ...doc,
        issuer: doc.issuer.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      } as CredentialDoc)
    },
    async setStatus(credentialId, status) {
      await c.credentials.updateOne(
        { credentialId },
        { $set: { status, updatedAt: nowIso() } },
      )
    },
  }
}

function receiptRepo(c: Collections): ReceiptRepo {
  return {
    async get(receiptId) {
      return c.receipts.findOne({ receiptId })
    },
    async upsert(doc) {
      await c.receipts.updateOne(
        { receiptId: doc.receiptId },
        { $set: { ...doc, updatedAt: nowIso() } },
        { upsert: true },
      )
    },
  }
}

function anchorRepo(c: Collections): AnchorRepo {
  return {
    async get(credentialId) {
      return c.anchors.findOne({ credentialId })
    },
    async upsert(doc) {
      const now = nowIso()
      await c.anchors.updateOne(
        { credentialId: doc.credentialId },
        {
          $set: { ...defined(doc), updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      )
    },
  }
}

function revocationRepo(c: Collections): RevocationRepo {
  return {
    async get(credentialId) {
      return c.revocations.findOne({ credentialId })
    },
    async upsert(doc) {
      const now = nowIso()
      await c.revocations.updateOne(
        { credentialId: doc.credentialId },
        {
          $set: { ...defined({ ...doc, issuer: doc.issuer.toLowerCase() }), updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      )
    },
  }
}

function auditRepo(c: Collections): AuditRepo {
  return {
    async append(entry) {
      await c.audit.insertOne({ ...defined(entry), at: entry.at ?? nowIso() } as AuditDoc)
    },
  }
}

/** Assemble all repositories over a Db handle. */
export function createRepositories(db: Db): Repositories {
  const c = collections(db)
  return {
    issuers: issuerRepo(c),
    credentials: credentialRepo(c),
    receipts: receiptRepo(c),
    anchors: anchorRepo(c),
    revocations: revocationRepo(c),
    audit: auditRepo(c),
  }
}

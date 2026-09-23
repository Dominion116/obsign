// Mongo client singleton + typed collection accessors + index setup. Mongo is
// cache/index only (INV-4). The GridFS bucket stores artifact-hash evidence
// bytes; everything else is a plain collection.

import { GridFSBucket, MongoClient, type Collection, type Db } from 'mongodb'
import type {
  AnchorDoc,
  AuditDoc,
  CredentialDoc,
  EvidenceDoc,
  IssuerDoc,
  JobDoc,
  PaymentProofDoc,
  ReceiptDoc,
  RevocationDoc,
  SiweNonceDoc,
} from './types.js'

let clientPromise: Promise<MongoClient> | null = null

/**
 * Lazily create (and cache) a single MongoClient for the process. Repeated calls
 * with the same URI reuse the connection; a fresh URI replaces it (mainly for
 * tests). Callers own graceful shutdown via {@link closeMongoClient}.
 */
export function getMongoClient(uri: string): Promise<MongoClient> {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri)
  }
  return clientPromise
}

/** Close and clear the cached client (tests / graceful shutdown). */
export async function closeMongoClient(): Promise<void> {
  if (clientPromise) {
    const client = await clientPromise
    clientPromise = null
    await client.close()
  }
}

/** The typed collection surface used across the platform. */
export interface Collections {
  issuers: Collection<IssuerDoc>
  credentials: Collection<CredentialDoc>
  evidence: Collection<EvidenceDoc>
  receipts: Collection<ReceiptDoc>
  anchors: Collection<AnchorDoc>
  revocations: Collection<RevocationDoc>
  queue: Collection<JobDoc>
  audit: Collection<AuditDoc>
  siweNonces: Collection<SiweNonceDoc>
  paymentProofs: Collection<PaymentProofDoc>
}

/** Resolve typed collections against a Db handle. */
export function collections(db: Db): Collections {
  return {
    issuers: db.collection<IssuerDoc>('issuers'),
    credentials: db.collection<CredentialDoc>('credentials'),
    evidence: db.collection<EvidenceDoc>('evidence'),
    receipts: db.collection<ReceiptDoc>('receipts'),
    anchors: db.collection<AnchorDoc>('anchors'),
    revocations: db.collection<RevocationDoc>('revocations'),
    queue: db.collection<JobDoc>('queue'),
    audit: db.collection<AuditDoc>('audit'),
    siweNonces: db.collection<SiweNonceDoc>('siwe_nonces'),
    paymentProofs: db.collection<PaymentProofDoc>('x402_proofs'),
  }
}

/** GridFS bucket for artifact-hash evidence bytes. */
export function evidenceBucket(db: Db): GridFSBucket {
  return new GridFSBucket(db, { bucketName: 'evidence' })
}

/** TTL (seconds) for SIWE nonces before Mongo expires them. */
export const SIWE_NONCE_TTL_SECONDS = 600

/**
 * Create every index Phase 3 relies on. Idempotent: safe to run on each boot.
 * Uniqueness is what makes issuance/queue idempotent (INV-4, dedupe).
 */
export async function ensureIndexes(db: Db): Promise<void> {
  const c = collections(db)
  await Promise.all([
    c.issuers.createIndex({ address: 1 }, { unique: true }),
    c.credentials.createIndex({ credentialId: 1 }, { unique: true }),
    c.credentials.createIndex({ receiptId: 1 }, { unique: true }),
    c.credentials.createIndex({ issuer: 1 }),
    c.receipts.createIndex({ receiptId: 1 }, { unique: true }),
    c.anchors.createIndex({ credentialId: 1 }, { unique: true }),
    c.anchors.createIndex({ receiptId: 1 }),
    c.revocations.createIndex({ credentialId: 1 }, { unique: true }),
    c.queue.createIndex({ dedupeKey: 1 }, { unique: true }),
    c.queue.createIndex({ type: 1, status: 1, availableAt: 1 }),
    c.audit.createIndex({ at: 1 }),
    c.siweNonces.createIndex({ createdAt: 1 }, { expireAfterSeconds: SIWE_NONCE_TTL_SECONDS }),
    c.siweNonces.createIndex({ nonce: 1 }, { unique: true }),
    // Single-use x402 proofs (FR-4.4): uniqueness is what makes replay a
    // duplicate-key error. No TTL — a replayed proof must be rejected forever.
    c.paymentProofs.createIndex({ proofId: 1 }, { unique: true }),
    c.paymentProofs.createIndex({ consumedAt: 1 }),
  ])
}

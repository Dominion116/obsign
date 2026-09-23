// Artifact-hash evidence storage on GridFS. The issuer's artifact bytes are
// content-addressed (sha256) and size-capped (SEC-5). Bytes never affect a
// receiptId directly — the core hashes them at verify time — so this store is
// still cache-shaped (INV-4): the same artifact re-uploaded yields the same
// sha256.
//
// Note on the core EvidenceStore contract: @obsign/core's `EvidenceStore.get`
// is SYNCHRONOUS (the pure verifier never awaits, INV-1). GridFS is async, so we
// expose async `put`/`get` here and bridge to a synchronous core store via
// `snapshot(uris)`, which prefetches the referenced bytes into memory — the same
// async→sync pattern the SDK uses for chain reads.

import { ObjectId, type GridFSBucket } from 'mongodb'
import { evidenceStoreFromFixture, sha256Hex, type EvidenceStore } from '@obsign/core'

export const GRIDFS_SCHEME = 'gridfs://'

/** Thrown when an upload exceeds the configured byte cap (SEC-5). */
export class EvidenceTooLargeError extends Error {
  constructor(readonly bytes: number, readonly maxBytes: number) {
    super(`Evidence artifact is ${bytes} bytes, exceeding the ${maxBytes}-byte cap`)
    this.name = 'EvidenceTooLargeError'
  }
}

export interface PutResult {
  uri: string
  sha256: string
  bytes: number
}

export interface PutMeta {
  contentType?: string
  filename?: string
}

function idFromUri(uri: string): ObjectId | null {
  if (!uri.startsWith(GRIDFS_SCHEME)) return null
  const raw = uri.slice(GRIDFS_SCHEME.length)
  if (!ObjectId.isValid(raw)) return null
  return new ObjectId(raw)
}

export class GridFSEvidenceStore {
  constructor(
    private readonly bucket: GridFSBucket,
    private readonly maxBytes: number,
  ) {}

  /** Store artifact bytes; rejects anything over the cap. Returns its gridfs uri. */
  async put(bytes: Uint8Array, meta: PutMeta = {}): Promise<PutResult> {
    if (bytes.byteLength > this.maxBytes) {
      throw new EvidenceTooLargeError(bytes.byteLength, this.maxBytes)
    }
    const sha256 = sha256Hex(bytes)
    const filename = meta.filename ?? sha256
    const upload = this.bucket.openUploadStream(filename, {
      metadata: { sha256, contentType: meta.contentType },
    })
    await new Promise<void>((resolve, reject) => {
      upload.on('error', reject)
      upload.on('finish', () => resolve())
      upload.end(Buffer.from(bytes))
    })
    return { uri: `${GRIDFS_SCHEME}${upload.id.toString()}`, sha256, bytes: bytes.byteLength }
  }

  /** Fetch artifact bytes by gridfs uri. Returns null when missing/unreachable. */
  async get(uri: string): Promise<Uint8Array | null> {
    const id = idFromUri(uri)
    if (!id) return null
    try {
      const chunks: Buffer[] = []
      const stream = this.bucket.openDownloadStream(id)
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (c: Buffer) => chunks.push(c))
        stream.on('error', reject)
        stream.on('end', () => resolve())
      })
      return new Uint8Array(Buffer.concat(chunks))
    } catch {
      return null
    }
  }

  /**
   * Prefetch the referenced uris and return a synchronous core EvidenceStore.
   * Unreachable uris resolve to null (the core fails closed → ARTIFACT_MISSING).
   */
  async snapshot(uris: string[]): Promise<EvidenceStore> {
    const fixture: Record<string, { hex: string }> = {}
    for (const uri of uris) {
      const bytes = await this.get(uri)
      if (bytes) {
        let hex = ''
        for (const b of bytes) hex += b.toString(16).padStart(2, '0')
        fixture[uri] = { hex }
      }
    }
    return evidenceStoreFromFixture(fixture)
  }
}

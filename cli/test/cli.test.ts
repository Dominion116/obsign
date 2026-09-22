import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { chainReaderFromFixture, evidenceStoreFromFixture, verify } from '@obsign/core'
import { run } from '../src/index.js'

// The CLI must produce a receipt whose derived truth is byte-identical to
// @obsign/core for the same inputs. We drive the exported run() in-process and
// capture stdout, avoiding brittle subprocess/argv plumbing.

const credential = {
  v: 1,
  credentialId: '0xcred0000000000000000000000000000000000000000000000000000000008',
  issuer: '0x1111111111111111111111111111111111111111',
  subject: '0x6666666666666666666666666666666666666666',
  claim: { type: 'artifact', context: 'release-attestation', details: {} },
  evidenceRefs: ['0xevd0000000000000000000000000000000000000000000000000000000008'],
  issuedAt: '2026-09-16T00:00:00.000Z',
  validFrom: '2026-09-16T00:00:00.000Z',
  validUntil: '2027-09-16T00:00:00.000Z',
  nonce: '0x00000000000000000000000000000011',
}

const evidence = {
  v: 1,
  kind: 'artifact-hash',
  algo: 'sha256',
  hash: '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  uri: 'gridfs://artifacts/0008',
  mime: 'application/gzip',
  bytes: 4,
}

const context = {
  now: '2026-10-01T00:00:00.000Z',
  chain: { revoked: [] },
  artifacts: { 'gridfs://artifacts/0008': { utf8: 'test' } },
}

let dir: string
let out: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'obsign-cli-'))
  writeFileSync(join(dir, 'c.json'), JSON.stringify(credential))
  writeFileSync(join(dir, 'e.json'), JSON.stringify(evidence))
  writeFileSync(join(dir, 'ctx.json'), JSON.stringify(context))
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function captureStdout(): { restore: () => void; text: () => string } {
  let buf = ''
  const impl = (chunk: unknown): boolean => {
    buf += String(chunk)
    return true
  }
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation(impl as never)
  return { restore: () => spy.mockRestore(), text: () => buf }
}

function baseArgs(extra: string[]): string[] {
  return [
    'verify',
    '--credential',
    join(dir, 'c.json'),
    '--evidence',
    join(dir, 'e.json'),
    '--context',
    join(dir, 'ctx.json'),
    ...extra,
  ]
}

describe('obsign verify CLI', () => {
  it('emits a receipt matching core exactly', () => {
    out = join(dir, 'receipt.json')
    const cap = captureStdout()
    const code = run(baseArgs(['--out', out]))
    cap.restore()

    expect(code).toBe(0)
    expect(cap.text()).toContain('valid OK')

    const receipt = JSON.parse(readFileSync(out, 'utf8'))
    const core = verify(credential, evidence, {
      now: context.now,
      chain: chainReaderFromFixture(context.chain),
      store: evidenceStoreFromFixture(context.artifacts),
    })
    expect(receipt.result).toBe(core.result)
    expect(receipt.reasonCode).toBe(core.reasonCode)
    expect(receipt.receiptId).toBe(core.receiptId)
    expect(receipt.credentialHash).toBe(core.credentialHash)
    expect(receipt.evidenceHash).toBe(core.evidenceHash)
    expect(receipt.verifier).toBe('obsign-core/1.0.0')
  })

  it('prints the receipt to stdout when no --out is given', () => {
    const cap = captureStdout()
    const code = run(baseArgs([]))
    cap.restore()

    expect(code).toBe(0)
    const receipt = JSON.parse(cap.text())
    expect(receipt.result).toBe('valid')
    expect(receipt.reasonCode).toBe('OK')
    expect(receipt.receiptId).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('receiptId is stable across invocations', () => {
    const first = captureStdout()
    run(baseArgs([]))
    first.restore()
    const second = captureStdout()
    run(baseArgs([]))
    second.restore()

    const a = JSON.parse(first.text())
    const b = JSON.parse(second.text())
    expect(a.receiptId).toBe(b.receiptId)
    expect(a.credentialHash).toBe(b.credentialHash)
  })
})

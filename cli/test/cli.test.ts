import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chainReaderFromFixture, evidenceStoreFromFixture, verify } from '@obsign/core'

// The CLI must produce a receipt whose derived truth is byte-identical to
// @obsign/core for the same inputs. We run the real CLI entry via vite-node and
// compare against a direct core call.

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_ENTRY = join(__dirname, '..', 'src', 'index.ts')
const require = createRequire(import.meta.url)
const VITE_NODE_ENTRY = require.resolve('vite-node/vite-node.mjs')

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

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'obsign-cli-'))
  writeFileSync(join(dir, 'c.json'), JSON.stringify(credential))
  writeFileSync(join(dir, 'e.json'), JSON.stringify(evidence))
  writeFileSync(join(dir, 'ctx.json'), JSON.stringify(context))
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

function runCli(extra: string[]): string {
  return execFileSync(
    process.execPath,
    [
      VITE_NODE_ENTRY,
      CLI_ENTRY,
      '--',
      'verify',
      '--credential',
      join(dir, 'c.json'),
      '--evidence',
      join(dir, 'e.json'),
      '--context',
      join(dir, 'ctx.json'),
      ...extra,
    ],
    { encoding: 'utf8' },
  )
}

describe('obsign verify CLI', () => {
  it('emits a receipt matching core exactly', () => {
    const out = runCli(['--out', join(dir, 'receipt.json')])
    expect(out).toContain('valid OK')

    const receipt = JSON.parse(readFileSync(join(dir, 'receipt.json'), 'utf8'))
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

  it('receiptId is stable across invocations', () => {
    const first = JSON.parse(runCli([]))
    const second = JSON.parse(runCli([]))
    expect(first.receiptId).toBe(second.receiptId)
    expect(first.credentialHash).toBe(second.credentialHash)
  })
})

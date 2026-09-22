import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { verify } from '@obsign/core'
import { loadVectors } from '../src/loader.js'
import { prepareVector } from '../src/prepare.js'

// INV-2 cross-process determinism: a receipt computed in this process must equal
// one computed in a fresh Node process. Combined with the Linux/Windows CI
// matrix, this proves byte-identical receiptIds across platforms.

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const EMITTER = join(__dirname, 'emit-receipt.ts')

// Resolve vite-node's ESM entry so we can re-run the TypeScript emitter in a
// fresh process without depending on a platform-specific .bin shim.
const require = createRequire(import.meta.url)
const VITE_NODE_ENTRY = require.resolve('vite-node/vite-node.mjs')

const loaded = loadVectors()

describe('cross-process determinism (INV-2)', () => {
  // Exercise one vector per evidence kind to keep the spawn count low.
  const sample = ['quorum-valid-01.json', 'onchain-valid-01.json', 'artifact-valid-01.json']

  for (const file of sample) {
    it(`reproduces ${file} in a fresh process`, () => {
      const match = loaded.find((l) => l.file === file)
      expect(match, `vector ${file} must exist`).toBeTruthy()
      const { credential, evidence, ctx } = prepareVector(match!.vector)
      const inProcess = verify(credential, evidence, ctx)

      const raw = execFileSync(process.execPath, [VITE_NODE_ENTRY, EMITTER, '--', file], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      })
      const line = raw.trim().split('\n').pop() ?? '{}'
      const external = JSON.parse(line)

      expect(external.receiptId).toBe(inProcess.receiptId)
      expect(external.credentialHash).toBe(inProcess.credentialHash)
      expect(external.evidenceHash).toBe(inProcess.evidenceHash)
      expect(external.reasonCode).toBe(inProcess.reasonCode)
    })
  }
})

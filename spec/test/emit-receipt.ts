// Cross-process determinism harness (INV-2). Emits the verify() result for one
// prepared golden vector as a single JSON line on stdout, so a parent test can
// spawn a *fresh* Node process and assert byte-identical receiptIds across
// processes and platforms.
//
// Usage:  vite-node spec/test/emit-receipt.ts -- <vector-file-name>

import { verify } from '@obsign/core'
import { loadVectors } from '../src/loader.js'
import { prepareVector } from '../src/prepare.js'

const target = process.argv[process.argv.length - 1]
const loaded = loadVectors()
const match = loaded.find((l) => l.file === target)
if (!match) {
  process.stderr.write(`emit-receipt: unknown vector "${target}"\n`)
  process.exit(2)
}
const { credential, evidence, ctx } = prepareVector(match.vector)
const result = verify(credential, evidence, ctx)
process.stdout.write(JSON.stringify(result))

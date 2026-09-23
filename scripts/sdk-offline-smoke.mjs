// SDK publish smoke check (FR-4.8 acceptance: "npm SDK installs and verifies a
// vector offline"). Runs against the BUILT, bundled dist entrypoint — the exact
// bytes that ship to npm — importing it the way a consumer would and verifying a
// golden vector with no network. @obsign/core is inlined by tsup, so this must
// work with only viem present in node_modules.
//
// RULE-1: executed by CI (after `npm run -w @obsign/sdk build`), never locally.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const distEntry = join(repoRoot, 'packages', 'sdk', 'dist', 'index.js')
const vectorPath = join(repoRoot, 'spec', 'vectors', 'onchain-valid-01.json')

function fail(msg) {
  console.error(`[sdk-smoke] FAIL: ${msg}`)
  process.exit(1)
}

const { verifyOffline } = await import(pathToFileURL(distEntry).href).catch((err) =>
  fail(`could not import built SDK at ${distEntry}: ${err.message}`),
)

if (typeof verifyOffline !== 'function') {
  fail('built SDK does not export verifyOffline')
}

const vector = JSON.parse(readFileSync(vectorPath, 'utf8'))
const receipt = verifyOffline(vector.credential, vector.evidence, {
  now: vector.context.now,
  chain: vector.context.chain,
})

if (!/^0x[0-9a-f]{64}$/.test(receipt.receiptId)) {
  fail(`receiptId is not 0x+64hex: ${receipt.receiptId}`)
}
if (receipt.result !== vector.expectedResult) {
  fail(`result ${receipt.result} !== expected ${vector.expectedResult}`)
}
if (receipt.reasonCode !== vector.expectedReasonCode) {
  fail(`reasonCode ${receipt.reasonCode} !== expected ${vector.expectedReasonCode}`)
}

console.log(
  `[sdk-smoke] OK: offline-verified ${vector.name} → ${receipt.result} ${receipt.reasonCode} ${receipt.receiptId}`,
)

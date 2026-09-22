// Cross-platform receiptId digest (INV-2). Emits one stable line per golden
// vector: "<file> <receiptId> <credentialHash> <evidenceHash> <reasonCode>".
// CI runs this on Linux and Windows and diffs the outputs; any divergence is a
// determinism bug. Run via vite-node (no build step, RULE-1 friendly).

import { verify } from '@obsign/core'
import { loadVectors } from '../src/loader.js'
import { prepareVector } from '../src/prepare.js'

const loaded = loadVectors()
const lines: string[] = []
for (const { file, vector } of loaded) {
  const { credential, evidence, ctx } = prepareVector(vector)
  const r = verify(credential, evidence, ctx)
  lines.push(`${file} ${r.receiptId} ${r.credentialHash} ${r.evidenceHash} ${r.reasonCode}`)
}
lines.sort()
process.stdout.write(lines.join('\n') + '\n')

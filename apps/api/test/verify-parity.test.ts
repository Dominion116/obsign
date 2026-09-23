// API↔CLI receiptId equality (Phase 4 acceptance + INV-2). For every golden
// vector, the API's shared verify path (`runVerify`) must produce the exact same
// receiptId and verdict as the CLI/oracle path (`buildReceipt`). Both call
// @obsign/core, so this guards against the API ever diverging from the core (e.g.
// re-deriving a hash). Pure (fixtures only) — runs on both the Linux and Windows
// CI legs, so it also strengthens cross-platform determinism.

import { describe, expect, it } from 'vitest'
import { buildReceipt } from '@obsign/core'
import { loadVectors } from '@obsign/spec/vectors'
import { prepareVector } from '@obsign/spec/prepare'
import { fixtureVerifyDeps, runVerify } from '../src/verify-service.js'

describe('POST /api/v1/verify receiptId == CLI receiptId for every golden vector', () => {
  for (const { file, vector } of loadVectors()) {
    it(file, async () => {
      const { credential, evidence, ctx } = prepareVector(vector)

      // The CLI/oracle path: @obsign/core directly.
      const cli = buildReceipt(credential, evidence, ctx)

      // The API path: the same shared core call, fed pinned fixture context.
      const api = await runVerify(fixtureVerifyDeps(ctx), { credential, evidence })

      expect(api.receiptId).toBe(cli.receiptId)
      expect(api.credentialHash).toBe(cli.credentialHash)
      expect(api.evidenceHash).toBe(cli.evidenceHash)
      expect(api.result).toBe(cli.result)
      expect(api.reasonCode).toBe(cli.reasonCode)
      // And both agree with the frozen expected verdict.
      expect(api.reasonCode).toBe(vector.expectedReasonCode)
      expect(api.result).toBe(vector.expectedResult)
    })
  }
})

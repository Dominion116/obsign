# Golden vectors

These files freeze the receipt contract defined in [`../receipt.md`](../receipt.md).
Each vector is a JSON object with this shape (see `../src/types.ts`):

| Field | Meaning |
| --- | --- |
| `name` | Unique vector id. |
| `description` | What the vector exercises. |
| `credential` | The credential under test. |
| `evidence` | The evidence item under test. |
| `context` | Injected `{ now, chain }` — the only inputs to the pure core besides credential + evidence (INV-1). |
| `expectedResult` | `valid` or `invalid`. |
| `expectedReasonCode` | Exactly one code from the closed set (spec §6). |
| `expectedReceiptId` | Frozen `0x…` receipt id. **Omitted in Phase 0**; populated once the Phase 1 reference core exists, then frozen. |

## Coverage

| Vector | Kind | Expected reason |
| --- | --- | --- |
| `quorum-valid-01` | quorum | OK |
| `quorum-valid-02` | quorum | OK |
| `quorum-invalid-threshold` | quorum | QUORUM_THRESHOLD_NOT_MET |
| `quorum-invalid-duplicate-signer` | quorum | DUPLICATE_QUORUM_SIGNER |
| `onchain-valid-01` | onchain-event | OK |
| `onchain-invalid-blockhash` | onchain-event | BLOCK_HASH_MISMATCH |
| `onchain-invalid-not-found` | onchain-event | EVENT_NOT_FOUND |
| `artifact-valid-01` | artifact-hash | OK |
| `artifact-invalid-hash-mismatch` | artifact-hash | ARTIFACT_HASH_MISMATCH |
| `artifact-invalid-unreachable` | artifact-hash | ARTIFACT_UNREACHABLE |
| `lifecycle-expired` | quorum | EXPIRED |
| `lifecycle-not-yet-valid` | quorum | NOT_YET_VALID |
| `lifecycle-revoked` | quorum | REVOKED |
| `malformed-credential-missing-field` | quorum | MALFORMED_CREDENTIAL |
| `malformed-unsupported-version` | quorum | UNSUPPORTED_VERSION |
| `malformed-unknown-evidence-kind` | (unknown) | UNKNOWN_EVIDENCE_KIND |

Three valid vectors (one per evidence kind), invalid cases per kind, credential
lifecycle cases, and malformed/unknown cases. This exceeds the Phase 0 minimum of
12 vectors.

## Phase 0 vs Phase 1

- **Phase 0 (now):** the harness in `../test/vectors.test.ts` loads every file,
  validates its structural shape, checks `expectedReasonCode` is in the closed
  set, and enforces the result↔reasonCode consistency rule. The verification
  engine does not exist yet, so `receiptId`/verdict are not yet computed.
- **Phase 1:** `packages/core` implements `verify()`. The harness will then run
  each vector through the core and assert both `expectedReasonCode` and (once
  frozen) `expectedReceiptId`. Freeze `expectedReceiptId` by generating it from
  the reference core, then commit — never hand-edit it afterward.

## Signatures / hashes in these fixtures

`signature`, `messageHash`, `blockHash`, and artifact `hash` values here are
illustrative fixtures for the Phase 0 shape contract. Phase 1 replaces the
crypto-bearing vectors with values produced by real signing/hashing so the core
verifies them for real, and the chain fixtures in `context.chain` back the
onchain-event module's injected `ChainReader`.

> All assertions run in CI only (RULE-1). Do not build or run these locally.

# Obsign Receipt Specification (normative)

- **Version:** 1 (`v: 1`)
- **Status:** normative
- **Hash:** keccak256 (Ethereum-style, 0x-prefixed lowercase hex, 32 bytes)
- **Canonicalization:** RFC 8785 (JSON Canonicalization Scheme, JCS)

This document is the authoritative contract. Any third party must be able to
reimplement verification from this document alone and reproduce a byte-identical
`receiptId` for the same credential and evidence. The reference implementation
lives in `packages/core`; where code and this document disagree, **this document
wins** and the code is a bug.

The keywords MUST, MUST NOT, SHOULD, and MAY are used as in RFC 2119.

---

## 1. Data model

### 1.1 Credential

```json
{
  "v": 1,
  "credentialId": "0x…",
  "issuer": "0x…",
  "subject": "0x… | fid:123 | did:key:…",
  "claim": {
    "type": "attendance | role | membership | artifact | custom",
    "context": "obsign-hackathon-2026",
    "details": {}
  },
  "evidenceRefs": ["0x…"],
  "issuedAt": "2026-09-13T00:00:00.000Z",
  "validFrom": "2026-09-13T00:00:00.000Z",
  "validUntil": "2027-09-13T00:00:00.000Z",
  "nonce": "0x…"
}
```

Field rules:

- `v` MUST equal `1`. Any other value → `UNSUPPORTED_VERSION`.
- `credentialId`, `issuer`, `nonce` MUST be `0x`-prefixed hex. `issuer` MUST be a
  20-byte address.
- `subject` MUST be a non-empty string.
- `claim.type` MUST be one of the enumerated types.
- `claim.context` MUST be a non-empty string.
- `evidenceRefs` MUST be an array of `0x`-prefixed hex strings.
- `issuedAt`, `validFrom`, `validUntil` MUST be RFC 3339 UTC timestamps with
  millisecond precision and a `Z` suffix.
- A credential missing a required field, or with a field of the wrong type, →
  `MALFORMED_CREDENTIAL`.

### 1.2 Evidence

Evidence is one item (or a set) whose `kind` selects the verification module.

**quorum**
```json
{
  "v": 1,
  "kind": "quorum",
  "credentialHash": "0x…",
  "threshold": 2,
  "messageHash": "0x…",
  "signers": [
    { "address": "0x…", "signature": "0x…" },
    { "address": "0x…", "signature": "0x…" }
  ]
}
```

**onchain-event**
```json
{
  "v": 1,
  "kind": "onchain-event",
  "chainId": 84532,
  "address": "0x…",
  "blockNumber": 12345678,
  "blockHash": "0x…",
  "txHash": "0x…",
  "logIndex": 3,
  "confirmations": 12,
  "expect": { "event": "Transfer(address,address,uint256)", "topics": [], "data": "0x…" }
}
```

**artifact-hash**
```json
{
  "v": 1,
  "kind": "artifact-hash",
  "algo": "sha256",
  "hash": "0x…",
  "uri": "ipfs://… | https://… | gridfs://…",
  "mime": "image/png",
  "bytes": 12345
}
```

An evidence item with an unrecognized `kind` → `UNKNOWN_EVIDENCE_KIND`. An item
of a known kind that is missing a required field → `MALFORMED_EVIDENCE`.

### 1.3 Receipt

```json
{
  "v": 1,
  "receiptId": "0x…",
  "credentialHash": "0x…",
  "evidenceHash": "0x…",
  "result": "valid | invalid",
  "reasonCode": "OK",
  "issuer": "0x…",
  "subject": "0x…",
  "verifiedAt": "2026-09-13T00:00:00.000Z",
  "verifier": "obsign-core/1.0.0",
  "anchor": { "chainId": 84532, "txHash": "0x…", "blockNumber": 12345678 },
  "paid": false
}
```

`receiptId`, `credentialHash`, `evidenceHash`, `result`, and `reasonCode` are the
**hashed/derived truth**. All other fields (`verifiedAt`, `verifier`, `anchor`,
`paid`) are metadata appended **outside** the hashed inputs and MUST NOT affect
the hashes or the verdict (INV-3).

---

## 2. Canonicalization (RFC 8785 / JCS)

Given any JSON value, produce canonical bytes as follows:

1. Objects: serialize members sorted by key using UTF-16 code-unit order, with no
   insignificant whitespace, each key as a JSON string, `:` separator, members
   separated by `,`.
2. Arrays: preserve element order; serialize each element canonically; `,`
   separated; no whitespace.
3. Strings: JSON escaping per RFC 8785 (minimal escapes; use `\uXXXX` only where
   required).
4. Numbers: serialize per RFC 8785 / ECMAScript `Number` shortest round-trip.
   Credential/evidence numeric fields in this spec are integers and MUST be
   serialized without a decimal point or exponent.
5. Literals: `true`, `false`, `null` verbatim.
6. The canonical output is then UTF-8 encoded to bytes.

An implementation MUST NOT depend on host locale, key insertion order, or
platform floating-point formatting.

---

## 3. Hash construction (normative order)

```
credentialHash = keccak256( utf8( JCS(credential) ) )
evidenceHash   = keccak256( utf8( JCS(evidenceSet) ) )
receiptId      = keccak256( concat( credentialHash, evidenceHash ) )
```

Where:

- `JCS(x)` is the canonical string from §2.
- `utf8(s)` is the UTF-8 byte encoding of that string.
- `evidenceSet` is the evidence value canonicalized as a whole. When multiple
  evidence items are present they MUST first be sorted by the canonical byte
  order of each item's `JCS` form before being placed in the set array.
- `concat(a, b)` concatenates the **raw 32 bytes** of `credentialHash` followed
  by the raw 32 bytes of `evidenceHash` (64 bytes total), then hashes them. It is
  NOT the concatenation of the hex strings.
- `credentialHash`, `evidenceHash`, `receiptId` are rendered as `0x` + 64
  lowercase hex chars.

`evidenceRefs` inside the credential MUST be sorted by canonical byte order
before the credential is canonicalized (so ref order never changes the hash).

---

## 4. Verification procedure

1. If `credential.v !== 1` → `result: invalid`, `UNSUPPORTED_VERSION`.
2. Validate credential shape (§1.1). On failure → `MALFORMED_CREDENTIAL`.
3. Validate each evidence item (§1.2). Unknown kind → `UNKNOWN_EVIDENCE_KIND`;
   malformed known kind → `MALFORMED_EVIDENCE`.
4. Verify the issuer signature over the credential (EIP-191 / EIP-712) against
   `credential.issuer`. Bad signature → `INVALID_ISSUER_SIGNATURE`. Unknown or
   inactive issuer (from the registry, when available) → `UNKNOWN_ISSUER` /
   `ISSUER_NOT_ACTIVE`.
5. Run the evidence module for the item's `kind` (§5).
6. Check the validity window against injected `ctx.now`:
   `now < validFrom` → `NOT_YET_VALID`; `now > validUntil` → `EXPIRED`.
7. Check revocation (via injected `ChainReader`): revoked → `REVOKED`.
8. If all checks pass → `result: valid`, `OK`. Otherwise `result: invalid` with
   the first failing reason code, in the order above.
9. Compute `credentialHash`, `evidenceHash`, `receiptId` per §3 **regardless of
   verdict** — the hashes describe the inputs, not the outcome.

The verifier is pure (INV-1): the only inputs are `credential`, `evidence`, and
`ctx = { now: string, chain: ChainReader }`. No ambient clock, network, DB, or
randomness.

---

## 5. Evidence modules

### 5.1 quorum
- `threshold` MUST be an integer ≥ 1.
- Each signer signature MUST recover (EIP-191 personal-sign over `messageHash`)
  to the stated `address`.
- All signer addresses MUST be unique → duplicate → `DUPLICATE_QUORUM_SIGNER`.
- Each recovered signer MUST be in the credential's authorized signer set (when a
  set is provided) → otherwise `UNKNOWN_QUORUM_SIGNER`.
- `messageHash` MUST match the expected message binding for the credential →
  otherwise `QUORUM_MESSAGE_MISMATCH`.
- If fewer than `threshold` valid, unique, authorized signatures →
  `QUORUM_THRESHOLD_NOT_MET`. All satisfied → `OK`.

### 5.2 onchain-event (INV-6: pinned reads)
- Read the block at `blockNumber` via `ChainReader`; its hash MUST equal
  `blockHash` → otherwise `BLOCK_HASH_MISMATCH`.
- Confirmation depth MUST be ≥ the required minimum → otherwise
  `INSUFFICIENT_CONFIRMATIONS`.
- The log at (`txHash`, `logIndex`) MUST exist and originate from `address` →
  otherwise `EVENT_NOT_FOUND`.
- The event signature/topics/data MUST match `expect` → otherwise
  `EVENT_FIELD_MISMATCH`.
- If the chain reader is unavailable, fail closed → `CHAIN_UNAVAILABLE`.
- Never read `latest`; always the pinned block.

### 5.3 artifact-hash
- Fetch bytes for `uri` via the injected `EvidenceStore` (the store, not the
  core, performs I/O).
- Recompute `sha256(bytes)`; it MUST equal `hash` → otherwise
  `ARTIFACT_HASH_MISMATCH`.
- If the artifact cannot be retrieved → `ARTIFACT_UNREACHABLE`.

---

## 6. Reason codes (complete, closed set)

```
OK
MALFORMED_CREDENTIAL
UNSUPPORTED_VERSION
MALFORMED_EVIDENCE
UNKNOWN_EVIDENCE_KIND
INVALID_ISSUER_SIGNATURE
UNKNOWN_ISSUER
ISSUER_NOT_ACTIVE
QUORUM_THRESHOLD_NOT_MET
UNKNOWN_QUORUM_SIGNER
DUPLICATE_QUORUM_SIGNER
QUORUM_MESSAGE_MISMATCH
EVENT_NOT_FOUND
INSUFFICIENT_CONFIRMATIONS
BLOCK_HASH_MISMATCH
EVENT_FIELD_MISMATCH
CHAIN_UNAVAILABLE
ARTIFACT_HASH_MISMATCH
ARTIFACT_UNREACHABLE
NOT_YET_VALID
EXPIRED
REVOKED
```

A verifier MUST return exactly one reason code from this set. A bare boolean is
never a valid result. Adding a reason code is a spec version change.

---

## 7. Versioning

- The receipt envelope is versioned by `v`. `v: 1` is defined here.
- A consumer receiving an unknown `v` MUST return `UNSUPPORTED_VERSION` rather
  than guess.
- The reason-code set (§6) and the hash construction (§3) are frozen for `v: 1`.
  Any change requires a new `v` and new golden vectors.

---

## 8. Golden vectors

`spec/vectors/*.json` freezes this contract. Each vector declares a credential,
evidence, the injected context, and the `expectedReasonCode` (and, once the
Phase 1 reference implementation lands, the frozen `expectedReceiptId`). The
harness in `spec/test` loads and asserts every vector. See
`spec/vectors/README.md`.

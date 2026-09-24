# Policies

Versioned, published vetting rules the Obsign Sentinel agent enforces (Phase 6).

Each policy is canonicalized with RFC 8785 (JCS) and hashed:

```
policyHash = keccak256(utf8(JCS(policy)))
```

The hash is anchored on Base Sepolia via `ObsignPolicyRegistry.registerPolicy(bytes32)`
(deployed at `0xdf8387709cCfeFE5CE61Af1b1F70A76a4cDBf920`). The agent recomputes the
same hash at runtime and cites it in every vetting report, so the rule a decision
was made under is verifiable and immutable.

Field order in these JSON files is irrelevant — JCS sorts keys before hashing.

## Files

- `attendance-v1.json` — attendance claims for `obsign-hackathon-2026`, requiring a
  valid, non-revoked `artifact-hash` credential from the registered issuer. This is
  the policy the `/sentinel` demo run enforces (mirrored by `DEMO_POLICY` in
  `@obsign/agent`).
- `deployments.json` — records each policy's `policyHash` and its `registerPolicy`
  transaction. Populated by the anchor script; not edited by hand.

## Anchoring a policy

Anchoring signs and sends a transaction, so it runs in ops/CI with a funded testnet
wallet — never in a local build (RULE-1):

```
node scripts/anchor-policy.mjs policies/attendance-v1.json
```

Environment: `BASE_SEPOLIA_RPC_URL`, `AGENT_WALLET_KEY` (testnet only), and
`POLICY_REGISTRY_ADDRESS`. The script computes the policy hash, calls
`registerPolicy` (a no-op if already registered), and appends the result to
`deployments.json`.

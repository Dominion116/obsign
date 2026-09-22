# Obsign contracts (Phase 2 — Onchain Layer)

Immutable contracts for Base Sepolia (chainId `84532`). No proxy, no owner, no
admin (D11 / FR-2.4). Foundry project.

> **RULE-1:** `forge build` / `forge test` / deploys run in **CI only** — never
> locally. See `.github/workflows/ci.yml` (build + unit/fuzz) and
> `.github/workflows/deploy-testnet.yml` (manual deploy + BaseScan verify).

## Contracts

| Contract | Purpose | Key functions |
|---|---|---|
| `ObsignAnchor` | Commit `receiptId` + `credentialHash` onchain (FR-2.1). Anchor once; re-anchor reverts (`AlreadyAnchored`). | `anchor(bytes32,bytes32)`, `isAnchored(bytes32)`, `credentialHashOf(bytes32)` |
| `ObsignRevocation` | Issuer-scoped revocation (FR-2.2). `revoke` is scoped to `msg.sender`; a credential resolves via `isRevokedBy(hash, itsIssuer)` (non-griefable). | `revoke(bytes32)`, `isRevoked(bytes32)`, `isRevokedBy(bytes32,address)` |
| `ObsignIssuerRegistry` | Permissionless issuer registry (FR-2.3). Self-registration; commits metadata hash only. | `registerIssuer(bytes32)`, `statusOf(address)`, `metadataHashOf(address)` |
| `ObsignPolicyRegistry` | Anchor a policy hash (A4) for the Sentinel agent. Register once; re-register reverts. | `registerPolicy(bytes32)`, `isRegistered(bytes32)`, `registrantOf(bytes32)` |

Interfaces (mirroring PRD §9.3) live in `src/interfaces.sol`.

## Tests (`test/`, CI-executed)

- Unit + event emission for all four contracts.
- Fuzz: anchor/policy register-once + revert; revocation scoping; independence.
- `Immutability.t.sol`: asserts runtime bytecode contains no `SELFDESTRUCT`/`DELEGATECALL`.
- `ReorgFork.t.sol`: secret-gated Base Sepolia fork reorg / pinned-read
  (`BLOCK_HASH_MISMATCH`/`EVENT_NOT_FOUND`) semantics; skips when
  `BASE_SEPOLIA_RPC_URL` is unset.

## Dependencies

`forge-std` is fetched by CI (`forge install foundry-rs/forge-std`) — see the
`contracts` job. It is not vendored in the repo.

## Deploy (CI/human only)

```
# dry run (simulate + gas, no tx):
forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia
# real deploy + verify:
forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify
```

Requires `DEPLOYER_PRIVATE_KEY` (funded testnet key), `BASE_SEPOLIA_RPC_URL`,
`BASESCAN_API_KEY`. Addresses are written to `deployments/84532.json` (committed;
source of truth for the SDK and `*_CONTRACT_ADDRESS` / `POLICY_REGISTRY_ADDRESS`
env vars).

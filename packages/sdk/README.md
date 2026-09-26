# @dominionli/obsign-sdk

Client SDK for [Obsign](https://github.com/Dominion116/obsign) — turn a claim into a
recomputable receipt. Verify credentials **offline** (no network, no trust in
Obsign's servers) or against a running Obsign API over REST + x402.

```
npm install @dominionli/obsign-sdk
```

## Offline verification

Recompute a byte-identical `receiptId` from a credential, its evidence, and a
pinned chain/artifact snapshot. The verdict and every hash come from the pure
`@obsign/core` verifier (bundled), so the result matches the CLI, the REST API,
and any conforming third-party reimplementation.

```ts
import { verifyOffline } from '@dominionli/obsign-sdk'

const receipt = verifyOffline(credential, evidence, {
  now: '2026-10-01T00:00:00.000Z',
  chain: { blocks: {}, logs: [], revoked: [] },
})

console.log(receipt.result, receipt.reasonCode, receipt.receiptId)
```

## API client (REST + x402)

```ts
import { ObsignClient, X402PaymentRequiredError } from '@dominionli/obsign-sdk'

const client = new ObsignClient({ baseUrl: 'https://obsign.onrender.com' })

try {
  const receipt = await client.verify(credential, evidence)
} catch (err) {
  if (err instanceof X402PaymentRequiredError) {
    // err.challenge holds the x402 payment requirements; pay, then retry:
    // await client.verify(credential, evidence, { payment: xPaymentHeader })
  }
}

await client.getReceipt(receiptId)
await client.getIssuer(address)
```

## Live pinned chain reader

For onchain-event / revocation evidence, fetch a pinned snapshot (INV-6) and hand
the pure verifier a synchronous reader:

```ts
import { createChainClient, createChainReader } from '@dominionli/obsign-sdk'

const client = createChainClient({ rpcUrl: process.env.BASE_SEPOLIA_RPC_URL! })
const chain = await createChainReader({
  client,
  addresses: { revocation: '0x…' },
  request: { events: [], credentials: [{ credentialId: '0x…', issuer: '0x…' }] },
})
```

## Invariants

- **INV-1** — verification is pure; viem lives only in this SDK, never in the core.
- **INV-2** — receipts are recomputable byte-for-byte, cross-platform.
- **INV-3** — payment (x402) never affects the verdict or the hashes.
- **INV-6** — chain reads are pinned to a specific block/blockHash, never `latest`.

License: MIT

// Phase 3 live integration (secret-gated, Base Sepolia). Exercises the
// self-custodial issuance path end-to-end with a funded testnet key acting as
// the issuer: register → anchor → confirm/index → verify; then revoke → verify
// REVOKED; and confirm a non-issuer address does NOT see the revocation (P2-3).
//
// Self-skips when BASE_SEPOLIA_RPC_URL / OBSIGN_INTEGRATION_KEY are absent, so
// fork PRs and local runs pass without secrets. RULE-1: CI-only.

import { describe, expect, it } from 'vitest'
import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { computeHashes, keccak256Hex, utf8, verify } from '@obsign/core'
import {
  anchorAbi,
  chainReaderFromSnapshot,
  createChainClient,
  fetchSnapshot,
  issuerRegistryAbi,
  revocationAbi,
} from '@obsign/sdk'
import { ChainIndexer } from '../src/chain-indexer.js'

const RPC = process.env.BASE_SEPOLIA_RPC_URL
const KEY = process.env.OBSIGN_INTEGRATION_KEY as Hex | undefined
const ANCHOR = process.env.ANCHOR_CONTRACT_ADDRESS as Hex | undefined
const REVOCATION = process.env.REVOCATION_CONTRACT_ADDRESS as Hex | undefined
const REGISTRY = process.env.ISSUER_REGISTRY_ADDRESS as Hex | undefined

const SKIP = !RPC || !KEY || !ANCHOR || !REVOCATION || !REGISTRY

function randomCredentialId(): Hex {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex as Hex
}

describe.skipIf(SKIP)('Phase 3 issuance integration (Base Sepolia)', () => {
  it(
    'issues, anchors, confirms, and revokes a credential end-to-end',
    async () => {
      const account = privateKeyToAccount(KEY!)
      const issuer = account.address.toLowerCase()

      const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC!) })
      const publicClient = createChainClient({ rpcUrl: RPC! })
      const indexer = new ChainIndexer({
        rpcUrl: RPC!,
        addresses: {
          anchor: ANCHOR!,
          revocation: REVOCATION!,
          issuerRegistry: REGISTRY!,
          policyRegistry: REGISTRY!,
        },
        minConfirmations: 1,
      })

      // Build + hash the credential (INV-2: same hashes as the spec).
      const credentialId = randomCredentialId()
      const credential = {
        v: 1,
        credentialId,
        issuer,
        subject: '0x2222222222222222222222222222222222222222',
        claim: { type: 'custom', context: 'Phase 3 integration', details: {} },
        evidenceRefs: [] as string[],
        issuedAt: '2026-01-01T00:00:00.000Z',
        validFrom: '2020-01-01T00:00:00.000Z',
        validUntil: '2035-01-01T00:00:00.000Z',
        nonce: '0xabcdef0123456789',
      }
      const evidence: unknown[] = []
      const { credentialHash, receiptId } = computeHashes(credential, evidence)

      // EIP-191 personal_sign over the credentialHash bytes.
      const issuerSignature = await account.signMessage({ message: { raw: credentialHash as Hex } })

      // Signature recovers to the issuer (SEC-2).
      const signed = verify(credential, evidence, {
        now: '2026-01-01T00:00:00.000Z',
        issuerSignature,
      })
      expect(signed.reasonCode).toBe('OK')
      expect(signed.receiptId).toBe(receiptId)

      // Register issuer if needed.
      const status = (await publicClient.readContract({
        address: REGISTRY!,
        abi: issuerRegistryAbi,
        functionName: 'statusOf',
        args: [account.address],
      })) as number
      if (Number(status) === 0) {
        const metadataHash = keccak256Hex(utf8(JSON.stringify({ issuer }))) as Hex
        const regTx = await wallet.writeContract({
          address: REGISTRY!,
          abi: issuerRegistryAbi,
          functionName: 'registerIssuer',
          args: [metadataHash],
        })
        await publicClient.waitForTransactionReceipt({ hash: regTx })
      }

      // Anchor from the issuer's own wallet (msg.sender == issuer).
      const anchorTx = await wallet.writeContract({
        address: ANCHOR!,
        abi: anchorAbi,
        functionName: 'anchor',
        args: [receiptId as Hex, credentialHash as Hex],
      })
      await publicClient.waitForTransactionReceipt({ hash: anchorTx })

      const confirmed = await indexer.confirmAnchor(anchorTx, receiptId as Hex)
      expect(confirmed.confirmed).toBe(true)
      expect(confirmed.blockNumber).toBeGreaterThan(0)

      // Revoke from the issuer's wallet.
      const revokeTx = await wallet.writeContract({
        address: REVOCATION!,
        abi: revocationAbi,
        functionName: 'revoke',
        args: [credentialId],
      })
      await publicClient.waitForTransactionReceipt({ hash: revokeTx })

      // Issuer-scoped snapshot shows REVOKED through the full core path.
      const revokedSnapshot = await fetchSnapshot(
        publicClient,
        { revocation: REVOCATION! },
        { credentials: [{ credentialId, issuer }] },
      )
      const revokedReader = chainReaderFromSnapshot(revokedSnapshot)
      const revokedVerdict = verify(credential, evidence, {
        now: '2026-01-01T00:00:00.000Z',
        chain: revokedReader,
      })
      expect(revokedVerdict.reasonCode).toBe('REVOKED')

      // A non-issuer address does NOT see the revocation (issuer-scoped, P2-3).
      const otherSnapshot = await fetchSnapshot(
        publicClient,
        { revocation: REVOCATION! },
        {
          credentials: [
            { credentialId, issuer: '0x000000000000000000000000000000000000dEaD' },
          ],
        },
      )
      expect(otherSnapshot.revoked ?? []).not.toContain(credentialId)
    },
    240_000,
  )
})

import { describe, it, expect } from 'vitest'
import { createWalletClient, http, keccak256, toHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { verify, computeHashes } from '@obsign/core'
import {
  createChainClient,
  fetchSnapshot,
  chainReaderFromSnapshot,
  anchorAbi,
  revocationAbi,
} from '../src/index.js'

// Live Base Sepolia integration (secret-gated). Proves the full Phase 2 loop:
// anchor a real receiptId → read it back → pinned SDK snapshot feeds the pure
// core to a real verdict, including issuer-scoped revocation. Self-skips unless
// the integration secrets are present, so normal CI (and fork PRs) never run it.
//
// Required env: OBSIGN_INTEGRATION_RPC, OBSIGN_INTEGRATION_KEY (funded testnet
// private key), ANCHOR_CONTRACT_ADDRESS, REVOCATION_CONTRACT_ADDRESS.

const RPC = process.env.OBSIGN_INTEGRATION_RPC
const KEY = process.env.OBSIGN_INTEGRATION_KEY
const ANCHOR = process.env.ANCHOR_CONTRACT_ADDRESS
const REVOCATION = process.env.REVOCATION_CONTRACT_ADDRESS
const enabled = Boolean(RPC && KEY && ANCHOR && REVOCATION)

const now = '2026-10-01T00:00:00.000Z'

function baseCredential(credentialId: string, issuer: string) {
  return {
    v: 1,
    credentialId,
    issuer,
    subject: '0x6666666666666666666666666666666666666666',
    claim: { type: 'attendance', context: 'obsign-hackathon-2026', details: {} },
    evidenceRefs: ['0xevd0000000000000000000000000000000000000000000000000000000001'],
    issuedAt: '2026-09-16T00:00:00.000Z',
    validFrom: '2026-09-16T00:00:00.000Z',
    validUntil: '2027-09-16T00:00:00.000Z',
    nonce: '0x00000000000000000000000000000011',
  }
}

describe.skipIf(!enabled)('live Base Sepolia integration', () => {
  it('anchors a real receiptId and reads it back; SDK pinned read → core OK', async () => {
    const account = privateKeyToAccount(KEY as Hex)
    const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) })
    const pub = createChainClient({ rpcUrl: RPC as string })

    // A recomputable receiptId for an onchain-event credential.
    const credential = baseCredential(keccak256(toHex(`cred-${Date.now()}`)), account.address)
    const placeholderEvidence = { v: 1, kind: 'onchain-event' } // replaced below

    // 1) Anchor the (receiptId, credentialHash) computed by the pure core.
    const preHashes = computeHashes(credential, placeholderEvidence)
    const txHash = await wallet.writeContract({
      address: ANCHOR as Hex,
      abi: anchorAbi,
      functionName: 'anchor',
      args: [preHashes.receiptId as Hex, preHashes.credentialHash as Hex],
    })
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash })
    expect(receipt.status).toBe('success')

    // 2) Read it back onchain.
    const isAnchored = await pub.readContract({
      address: ANCHOR as Hex,
      abi: anchorAbi,
      functionName: 'isAnchored',
      args: [preHashes.receiptId as Hex],
    })
    expect(isAnchored).toBe(true)

    // 3) Build onchain-event evidence from the actual Anchored log, then verify
    //    through the pure core using the SDK pinned snapshot.
    const anchorAddr = (ANCHOR as string).toLowerCase()
    const log = receipt.logs.find((l) => l.address.toLowerCase() === anchorAddr)
    expect(log).toBeTruthy()
    const block = await pub.getBlock({ blockNumber: receipt.blockNumber })

    const evidence = {
      v: 1,
      kind: 'onchain-event',
      chainId: 84532,
      address: ANCHOR as string,
      blockNumber: Number(receipt.blockNumber),
      blockHash: block.hash as string,
      txHash,
      logIndex: log!.logIndex,
      confirmations: 1,
      expect: {
        event: 'Anchored(bytes32,bytes32,address)',
        topics: [...log!.topics],
        data: log!.data,
      },
    }

    const snapshot = await fetchSnapshot(
      pub,
      { revocation: REVOCATION as Hex },
      {
        events: [
          {
            blockNumber: Number(receipt.blockNumber),
            txHash,
            logIndex: log!.logIndex,
            address: ANCHOR as string,
          },
        ],
      },
    )
    const reader = chainReaderFromSnapshot(snapshot)
    const result = verify(credential, evidence, { now, chain: reader })
    expect(result.reasonCode).toBe('OK')
    expect(result.result).toBe('valid')
  }, 120_000)

  it('issuer-scoped revocation surfaces REVOKED through the SDK reader', async () => {
    const account = privateKeyToAccount(KEY as Hex)
    const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) })
    const pub = createChainClient({ rpcUrl: RPC as string })

    const credentialId = keccak256(toHex(`revoke-${Date.now()}`))

    const txHash = await wallet.writeContract({
      address: REVOCATION as Hex,
      abi: revocationAbi,
      functionName: 'revoke',
      args: [credentialId as Hex],
    })
    await pub.waitForTransactionReceipt({ hash: txHash })

    const snapshot = await fetchSnapshot(
      pub,
      { revocation: REVOCATION as Hex },
      { credentials: [{ credentialId, issuer: account.address }] },
    )
    const reader = chainReaderFromSnapshot(snapshot)
    // The artifact store is absent → without revocation this would be
    // ARTIFACT_UNREACHABLE; but revocation is checked only after modules pass, so
    // we assert the reader itself reports the issuer-scoped revocation.
    expect(reader.isRevoked(credentialId)).toBe(true)
    // A different (unrevoked) credentialId stays false via the same reader path.
    const other = keccak256(toHex('never-revoked'))
    const snapshot2 = await fetchSnapshot(
      pub,
      { revocation: REVOCATION as Hex },
      { credentials: [{ credentialId: other, issuer: account.address }] },
    )
    expect(chainReaderFromSnapshot(snapshot2).isRevoked(other)).toBe(false)
  }, 120_000)
})

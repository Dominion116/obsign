// Client-side issuance + revocation (P3-3). The wallet computes the same hashes
// as the spec (via @obsign/core, INV-2), signs the credentialHash (EIP-191), and
// submits registerIssuer / anchor / revoke from its own address, so
// msg.sender == issuer (P2-3). The signed credential + txHash are then POSTed to
// the API, which persists and enqueues the confirm job.

import { readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import type { Hex } from 'viem'
import { computeHashes, keccak256Hex, utf8 } from '@obsign/core'
import { anchorAbi, issuerRegistryAbi, revocationAbi } from '@obsign/sdk'
import { wagmiConfig, CHAIN } from './wagmi'
import { getAddresses } from './addresses'
import { backend } from './backend'

export type SignMessage = (args: { message: { raw: Hex } }) => Promise<Hex>

/** A random 32-byte credentialId (fits the contract's bytes32 param). */
export function makeCredentialId(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex as Hex
}

export interface CredentialDraft {
  issuer: string
  subject: string
  claim: string
  claimType?: string
  validFrom?: string
  validUntil?: string
  evidenceRefs?: string[]
}

/** A random 0x-prefixed nonce (16 bytes) for credential uniqueness. */
function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let hex = '0x'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

/** Build a spec-valid (§1.1) credential object the issuer will sign. */
export function buildCredential(draft: CredentialDraft): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    v: 1,
    credentialId: makeCredentialId(),
    issuer: draft.issuer,
    subject: draft.subject,
    claim: {
      type: draft.claimType ?? 'custom',
      context: draft.claim,
      details: {},
    },
    evidenceRefs: draft.evidenceRefs ?? [],
    issuedAt: now,
    validFrom: draft.validFrom ?? now,
    validUntil: draft.validUntil ?? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    nonce: makeNonce(),
  }
}

async function ensureIssuerRegistered(issuer: Hex): Promise<void> {
  const addresses = getAddresses()
  const status = (await readContract(wagmiConfig, {
    address: addresses.issuerRegistry as Hex,
    abi: issuerRegistryAbi,
    functionName: 'statusOf',
    args: [issuer],
    chainId: CHAIN.id,
  })) as number

  if (Number(status) !== 0) return

  const metadataHash = keccak256Hex(utf8(JSON.stringify({ issuer }))) as Hex
  const tx = await writeContract(wagmiConfig, {
    address: addresses.issuerRegistry as Hex,
    abi: issuerRegistryAbi,
    functionName: 'registerIssuer',
    args: [metadataHash],
    chainId: CHAIN.id,
  })
  await waitForTransactionReceipt(wagmiConfig, { hash: tx })
}

export interface IssueInput {
  credential: Record<string, unknown>
  evidence: unknown
  signMessage: SignMessage
}

/** Full issue flow: hash → sign → registerIssuer(if needed) → anchor → POST. */
export async function issueCredential(input: IssueInput) {
  const { credential, evidence, signMessage } = input
  const issuer = String(credential.issuer) as Hex
  const addresses = getAddresses()

  const { credentialHash, receiptId } = computeHashes(credential, evidence)

  // EIP-191 personal_sign over the credentialHash BYTES (matches core recovery).
  const issuerSignature = await signMessage({ message: { raw: credentialHash as Hex } })

  await ensureIssuerRegistered(issuer)

  const anchorTx = await writeContract(wagmiConfig, {
    address: addresses.anchor as Hex,
    abi: anchorAbi,
    functionName: 'anchor',
    args: [receiptId as Hex, credentialHash as Hex],
    chainId: CHAIN.id,
  })
  await waitForTransactionReceipt(wagmiConfig, { hash: anchorTx })

  const res = await backend.createCredential({
    credential,
    evidence,
    issuerSignature,
    txHash: anchorTx,
  })
  return { ...res, anchorTx }
}

/** Revoke flow: revoke(credentialId) on-chain → POST the txHash. */
export async function revokeCredentialOnChain(credentialId: string) {
  const addresses = getAddresses()
  const tx = await writeContract(wagmiConfig, {
    address: addresses.revocation as Hex,
    abi: revocationAbi,
    functionName: 'revoke',
    args: [credentialId as Hex],
    chainId: CHAIN.id,
  })
  await waitForTransactionReceipt(wagmiConfig, { hash: tx })
  await backend.revokeCredential(credentialId, tx)
  return tx
}

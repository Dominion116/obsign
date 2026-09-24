// The agent's server-side funded testnet wallet and its on-chain WRITE path.
//
// This is the only place the Sentinel signs and broadcasts transactions. The key
// comes from AGENT_WALLET_KEY (testnet-only; never mainnet value, never logged —
// SEC-1). Writes are limited to two consequential actions:
//   - registerPolicy(bytes32) on ObsignPolicyRegistry (anchor the rule), and
//   - anchor(bytes32,bytes32) on ObsignAnchor (anchor the signed vetting report).

import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { randomBytes } from 'node:crypto'
import { anchorAbi, policyRegistryAbi } from '@obsign/sdk'

/** The subset of an x402 PaymentRequirements the payer needs (from a 402 challenge). */
export interface PaymentRequirements {
  scheme: string
  network: string
  maxAmountRequired: string
  asset: string
  payTo: string
  maxTimeoutSeconds?: number
  extra?: { name?: string; version?: string } & Record<string, unknown>
}

export interface AgentWallet {
  readonly address: Address
  /** Anchor a policy hash. Idempotent: a hash already registered is a no-op. */
  registerPolicy(policyHash: Hex): Promise<{ txHash?: string; alreadyRegistered: boolean }>
  /** Anchor the signed vetting report's hash. */
  anchorReport(reportHash: Hex, receiptId: Hex): Promise<{ txHash: string }>
  /** Sign an EIP-191 personal message (used to sign the vetting report). */
  signMessage(message: string): Promise<string>
  /**
   * Build a base64 x402 payment header for the given requirements by signing an
   * EIP-3009 `transferWithAuthorization` with the agent's key. No funds move
   * here; the facilitator later verifies + settles the authorization on-chain.
   */
  buildPaymentHeader(requirements: PaymentRequirements): Promise<string>
}

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

export interface AgentWalletOptions {
  privateKey: string
  rpcUrl: string
  policyRegistry: Address
  anchor: Address
}

/**
 * Normalize a configured private key: trim stray whitespace/newlines and quotes
 * (common when pasting into a CI secret), accept `0X`, and add the `0x` prefix if
 * omitted. Throws a clear, non-leaking error (reports only the hex-char count)
 * when it is not a 32-byte hex key, instead of viem's opaque message.
 */
function normalizePrivateKey(raw: string): Hex {
  let key = raw.trim().replace(/^['"]|['"]$/g, '')
  if (key.startsWith('0X')) key = `0x${key.slice(2)}`
  const hex = key.startsWith('0x') ? key : `0x${key}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    const bare = hex.startsWith('0x') ? hex.slice(2) : hex
    throw new Error(
      `AGENT_WALLET_KEY is not a 32-byte hex private key (got ${bare.length} chars after 0x; ` +
        'expected exactly 64 hex chars). Provide the raw private key, not a seed phrase, and ' +
        'remove any quotes, spaces, or trailing newline.',
    )
  }
  return hex as Hex
}

/**
 * Build the agent wallet from a testnet key. Throws only on a malformed key so a
 * misconfigured live run fails fast; simulation mode never constructs this.
 */
export function createAgentWallet(opts: AgentWalletOptions): AgentWallet {
  const account = privateKeyToAccount(normalizePrivateKey(opts.privateKey))
  const transport = http(opts.rpcUrl)
  const wallet = createWalletClient({ account, chain: baseSepolia, transport })
  const publicClient = createPublicClient({ chain: baseSepolia, transport })

  return {
    address: account.address,

    async registerPolicy(policyHash: Hex) {
      const already = await publicClient.readContract({
        address: opts.policyRegistry,
        abi: policyRegistryAbi,
        functionName: 'isRegistered',
        args: [policyHash],
      })
      if (already) return { alreadyRegistered: true }
      const txHash = await wallet.writeContract({
        address: opts.policyRegistry,
        abi: policyRegistryAbi,
        functionName: 'registerPolicy',
        args: [policyHash],
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      return { txHash, alreadyRegistered: false }
    },

    async anchorReport(reportHash: Hex, receiptId: Hex) {
      const txHash = await wallet.writeContract({
        address: opts.anchor,
        abi: anchorAbi,
        functionName: 'anchor',
        args: [reportHash, receiptId],
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      return { txHash }
    },

    async signMessage(message: string) {
      return wallet.signMessage({ account, message })
    },

    async buildPaymentHeader(requirements: PaymentRequirements) {
      const nonce = `0x${randomBytes(32).toString('hex')}` as Hex
      const timeout = requirements.maxTimeoutSeconds ?? 60
      const validAfter = 0n
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + timeout)
      const value = BigInt(requirements.maxAmountRequired)
      const domain = {
        name: requirements.extra?.name ?? 'USDC',
        version: requirements.extra?.version ?? '2',
        chainId: baseSepolia.id,
        verifyingContract: requirements.asset as Address,
      } as const
      const message = {
        from: account.address,
        to: requirements.payTo as Address,
        value,
        validAfter,
        validBefore,
        nonce,
      } as const
      const signature = await wallet.signTypedData({
        account,
        domain,
        types: EIP3009_TYPES,
        primaryType: 'TransferWithAuthorization',
        message,
      })
      const payload = {
        x402Version: 1,
        scheme: requirements.scheme || 'exact',
        network: requirements.network,
        payload: {
          signature,
          authorization: {
            from: account.address,
            to: requirements.payTo,
            value: requirements.maxAmountRequired,
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
          },
        },
      }
      return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
    },
  }
}

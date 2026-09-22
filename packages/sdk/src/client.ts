// viem public client factory for Base Sepolia. All network I/O lives in the SDK;
// the pure core never imports viem (INV-1).

import { createPublicClient, http, type Abi, type Address, type Hex } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA_CHAIN_ID } from './contracts.js'

export interface ChainClientOptions {
  /** JSON-RPC endpoint (e.g. process.env.BASE_SEPOLIA_RPC_URL). */
  rpcUrl: string
  /** Chain id; defaults to Base Sepolia (84532). */
  chainId?: number
}

/** A single log as returned in a transaction receipt. */
export interface ReceiptLog {
  logIndex: number
  address: Address
  topics: readonly Hex[]
  data: Hex
}

/** The subset of a transaction receipt the SDK reads. */
export interface TxReceipt {
  status: 'success' | 'reverted'
  blockNumber: bigint
  logs: readonly ReceiptLog[]
}

/**
 * The public-client surface the SDK uses, declared explicitly. viem's own
 * `PublicClient` alias is neither assignable from the concrete
 * `createPublicClient` result (TS2719) nor portably nameable in emitted
 * declarations (TS2742), so we pin the exact methods we call. All reads are
 * addressed by a pinned block/tx coordinate (INV-6) — never `latest`.
 */
export interface ObsignChainClient {
  getBlockNumber(): Promise<bigint>
  getBlock(args: { blockNumber: bigint }): Promise<{ hash: Hex | null; number: bigint | null }>
  getTransactionReceipt(args: { hash: Hex }): Promise<TxReceipt>
  waitForTransactionReceipt(args: { hash: Hex }): Promise<TxReceipt>
  readContract(args: {
    address: Address
    abi: Abi
    functionName: string
    args?: readonly unknown[]
  }): Promise<unknown>
}

/**
 * Create a read-only viem public client, exposed as the narrow
 * {@link ObsignChainClient}. The concrete viem client is structurally a superset,
 * so the cast is sound; narrowing keeps the SDK's emitted types portable.
 */
export function createChainClient(opts: ChainClientOptions): ObsignChainClient {
  if (!opts.rpcUrl) {
    throw new Error('createChainClient: rpcUrl is required (set BASE_SEPOLIA_RPC_URL)')
  }
  const chainId = opts.chainId ?? BASE_SEPOLIA_CHAIN_ID
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`createChainClient: unsupported chainId ${chainId} (expected Base Sepolia)`)
  }
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(opts.rpcUrl),
  })
  return client as unknown as ObsignChainClient
}

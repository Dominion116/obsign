// viem public client factory for Base Sepolia. All network I/O lives in the SDK;
// the pure core never imports viem (INV-1).

import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA_CHAIN_ID } from './contracts.js'

export interface ChainClientOptions {
  /** JSON-RPC endpoint (e.g. process.env.BASE_SEPOLIA_RPC_URL). */
  rpcUrl: string
  /** Chain id; defaults to Base Sepolia (84532). */
  chainId?: number
}

/**
 * Create a read-only viem public client. Reads are always addressed by a pinned
 * block/tx coordinate downstream (INV-6); this client never drives `latest`
 * verification on its own.
 *
 * The return type is inferred (not annotated as viem's bare `PublicClient`):
 * viem's exported `PublicClient` alias is not assignable from the concrete
 * `createPublicClient` result under strict mode (TS2719). Downstream code types
 * against `ObsignChainClient` (the inferred type) so a single, consistent client
 * type flows through the SDK.
 */
export function createChainClient(opts: ChainClientOptions) {
  if (!opts.rpcUrl) {
    throw new Error('createChainClient: rpcUrl is required (set BASE_SEPOLIA_RPC_URL)')
  }
  const chainId = opts.chainId ?? BASE_SEPOLIA_CHAIN_ID
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`createChainClient: unsupported chainId ${chainId} (expected Base Sepolia)`)
  }
  return createPublicClient({
    chain: baseSepolia,
    transport: http(opts.rpcUrl),
  })
}

/** The concrete public-client type used across the SDK (inferred from viem). */
export type ObsignChainClient = ReturnType<typeof createChainClient>

// Contract ABIs (read + write surfaces the SDK needs) and the deployment address
// loader. Addresses come from contracts/deployments/84532.json (the committed
// source of truth) with env-var overrides.

import type { Abi, Address } from 'viem'

/** Base Sepolia chain id. */
export const BASE_SEPOLIA_CHAIN_ID = 84532

export const anchorAbi = [
  {
    type: 'function',
    name: 'anchor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'receiptId', type: 'bytes32' },
      { name: 'credentialHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isAnchored',
    stateMutability: 'view',
    inputs: [{ name: 'receiptId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'credentialHashOf',
    stateMutability: 'view',
    inputs: [{ name: 'receiptId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'event',
    name: 'Anchored',
    inputs: [
      { name: 'receiptId', type: 'bytes32', indexed: true },
      { name: 'credentialHash', type: 'bytes32', indexed: true },
      { name: 'issuer', type: 'address', indexed: true },
    ],
  },
] as const satisfies Abi

export const revocationAbi = [
  {
    type: 'function',
    name: 'revoke',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'credentialHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isRevoked',
    stateMutability: 'view',
    inputs: [{ name: 'credentialHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isRevokedBy',
    stateMutability: 'view',
    inputs: [
      { name: 'credentialHash', type: 'bytes32' },
      { name: 'issuer', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const satisfies Abi

export const issuerRegistryAbi = [
  {
    type: 'function',
    name: 'registerIssuer',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'metadataHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'statusOf',
    stateMutability: 'view',
    inputs: [{ name: 'issuer', type: 'address' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'metadataHashOf',
    stateMutability: 'view',
    inputs: [{ name: 'issuer', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const satisfies Abi

export const policyRegistryAbi = [
  {
    type: 'function',
    name: 'registerPolicy',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'policyHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'policyHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'registrantOf',
    stateMutability: 'view',
    inputs: [{ name: 'policyHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const satisfies Abi

/** Resolved contract addresses for a chain. */
export interface ObsignAddresses {
  anchor: Address
  revocation: Address
  issuerRegistry: Address
  policyRegistry: Address
}

/** Raw shape of contracts/deployments/<chainId>.json. */
export interface DeploymentsFile {
  chainId: number
  status?: string
  anchor: string
  revocation: string
  issuerRegistry: string
  policyRegistry: string
}

const ZERO = '0x0000000000000000000000000000000000000000'

function isLiveAddress(a: string | undefined): a is string {
  return typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() !== ZERO
}

/**
 * Resolve Obsign contract addresses. Precedence: explicit overrides, then the
 * parsed deployments file. Throws if any address is missing or still the zero
 * (pending-deploy) placeholder, so callers fail fast rather than reading a
 * non-existent contract.
 */
export function resolveAddresses(
  deployments: DeploymentsFile | undefined,
  overrides: Partial<ObsignAddresses> = {},
): ObsignAddresses {
  const pick = (key: keyof ObsignAddresses, fromFile: string | undefined): Address => {
    const candidate = (overrides[key] as string | undefined) ?? fromFile
    if (!isLiveAddress(candidate)) {
      throw new Error(
        `Obsign address for "${key}" is missing or a zero placeholder. ` +
          `Deploy the contracts (deploy-testnet workflow) and commit deployments/84532.json, ` +
          `or pass an explicit override.`,
      )
    }
    return candidate as Address
  }
  return {
    anchor: pick('anchor', deployments?.anchor),
    revocation: pick('revocation', deployments?.revocation),
    issuerRegistry: pick('issuerRegistry', deployments?.issuerRegistry),
    policyRegistry: pick('policyRegistry', deployments?.policyRegistry),
  }
}

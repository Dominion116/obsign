// Environment loading + validation for the platform. `process.env` access is
// legitimate here (INV-1 forbids it only in packages/core). Loaders are
// functions, not top-level reads, so importing this module never throws and unit
// tests can construct infra directly against an in-memory Mongo.

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolveAddresses, type DeploymentsFile, type ObsignAddresses } from '@obsign/sdk'

/** Fully-resolved platform configuration. */
export interface PlatformConfig {
  mongoUri: string
  rpcUrl: string
  chainId: number
  evidenceMaxBytes: number
  anchorMinConfirmations: number
  sessionJwtSecret: string
  frontendOrigin: string
  cronSecret: string
  port: number
  /** Live contract addresses (from deployments/84532.json or env overrides). */
  anchorAddress: string
  revocationAddress: string
  issuerRegistryAddress: string
  policyRegistryAddress: string
  /**
   * x402 payment gate (Phase 4, FR-4.3). Empty strings mean "unconfigured": the
   * verify route then rejects with a 402 that carries no payTo, which is a
   * deployment misconfiguration rather than a Phase 3 boot failure — so these are
   * optional here and never touch the verdict or the hashes (INV-3).
   */
  x402PayeeAddress: string
  x402PriceUsdc: string
  x402FacilitatorUrl: string
}

type Env = Record<string, string | undefined>

const DEFAULTS = {
  chainId: 84532,
  evidenceMaxBytes: 5_242_880,
  anchorMinConfirmations: 12,
  port: 8080,
} as const

function required(env: Env, key: string): string {
  const v = env[key]
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return v
}

function intOr(env: Env, key: string, fallback: number): number {
  const raw = env[key]
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Environment variable ${key} must be a non-negative integer, got: ${raw}`)
  }
  return n
}

function strOr(env: Env, key: string, fallback: string): string {
  const v = env[key]
  return v === undefined || v === '' ? fallback : v
}

/**
 * Load and validate the full platform config. Throws a single, actionable error
 * when a required secret is missing. Optional numeric knobs fall back to the
 * documented defaults (see .env.example).
 */
export function loadConfig(env: Env = process.env): PlatformConfig {
  const addr = loadAddresses(env)
  return {
    mongoUri: required(env, 'MONGODB_URI'),
    rpcUrl: required(env, 'BASE_SEPOLIA_RPC_URL'),
    chainId: intOr(env, 'CHAIN_ID', DEFAULTS.chainId),
    evidenceMaxBytes: intOr(env, 'EVIDENCE_MAX_BYTES', DEFAULTS.evidenceMaxBytes),
    anchorMinConfirmations: intOr(env, 'ANCHOR_MIN_CONFIRMATIONS', DEFAULTS.anchorMinConfirmations),
    sessionJwtSecret: required(env, 'SESSION_JWT_SECRET'),
    frontendOrigin: required(env, 'FRONTEND_ORIGIN'),
    cronSecret: required(env, 'CRON_SECRET'),
    port: intOr(env, 'PORT', DEFAULTS.port),
    anchorAddress: addr.anchor,
    revocationAddress: addr.revocation,
    issuerRegistryAddress: addr.issuerRegistry,
    policyRegistryAddress: addr.policyRegistry,
    x402PayeeAddress: strOr(env, 'X402_PAYEE_ADDRESS', ''),
    x402PriceUsdc: strOr(env, 'X402_PRICE_USDC', ''),
    x402FacilitatorUrl: strOr(env, 'X402_FACILITATOR_URL', ''),
  }
}

/** Resolve live contract addresses from deployments/84532.json with env overrides. */
export function loadAddresses(env: Env = process.env): ObsignAddresses {
  const deployments = loadDeploymentsFile(env) as DeploymentsFile | undefined
  const overrides: Partial<ObsignAddresses> = {}
  if (env.ANCHOR_CONTRACT_ADDRESS) overrides.anchor = env.ANCHOR_CONTRACT_ADDRESS as `0x${string}`
  if (env.REVOCATION_CONTRACT_ADDRESS)
    overrides.revocation = env.REVOCATION_CONTRACT_ADDRESS as `0x${string}`
  if (env.ISSUER_REGISTRY_ADDRESS)
    overrides.issuerRegistry = env.ISSUER_REGISTRY_ADDRESS as `0x${string}`
  if (env.POLICY_REGISTRY_ADDRESS)
    overrides.policyRegistry = env.POLICY_REGISTRY_ADDRESS as `0x${string}`
  return resolveAddresses(deployments, overrides)
}

/** Read contracts/deployments/84532.json (the committed source of truth). */
export function loadDeploymentsFile(_env: Env = process.env): unknown {
  const require = createRequire(import.meta.url)
  const file = require.resolve('../../contracts/deployments/84532.json')
  return JSON.parse(readFileSync(file, 'utf8')) as unknown
}

export { DEFAULTS as CONFIG_DEFAULTS }

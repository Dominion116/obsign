// Agent configuration loader. process.env access is legitimate here (INV-1 bans
// it only in @obsign/core). Loaders are functions, not top-level reads, so
// importing this module never throws. Secrets are read but NEVER logged (SEC-1);
// keep them out of step details and out of source.

/** Fully-resolved Sentinel agent configuration. */
export interface AgentConfig {
  /** Groq API key. When absent the agent falls back to the deterministic planner. */
  groqApiKey?: string
  /** Groq model id (OpenAI-compatible). */
  groqModel: string
  /** Funded testnet wallet key (0x-prefixed). Absent → simulation-only. */
  agentWalletKey?: string
  /** Base Sepolia RPC URL for on-chain writes. */
  rpcUrl?: string
  /** Chain id (Base Sepolia = 84532). */
  chainId: number
  /** Obsign API base URL for the REST/x402 client. */
  apiBaseUrl: string
  /** Deployed ObsignPolicyRegistry address. */
  policyRegistryAddress?: string
  /** Deployed ObsignAnchor address (for anchoring the vetting report). */
  anchorAddress?: string
  /** Shared secret required to trigger a LIVE run (real spend + on-chain writes). */
  runSecret?: string
}

type Env = Record<string, string | undefined>

const DEFAULT_MODEL = 'openai/gpt-oss-20b'
const DEFAULT_CHAIN_ID = 84532

function strOr(env: Env, key: string, fallback: string): string {
  const v = env[key]
  return v === undefined || v === '' ? fallback : v
}

function intOr(env: Env, key: string, fallback: number): number {
  const raw = env[key]
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Load agent config from the environment. Every capability is optional: a run
 * degrades gracefully (no key → deterministic planner; no wallet → simulation)
 * rather than throwing at import or boot.
 */
export function loadAgentConfig(env: Env = process.env): AgentConfig {
  const config: AgentConfig = {
    groqModel: strOr(env, 'GROQ_MODEL', DEFAULT_MODEL),
    chainId: intOr(env, 'CHAIN_ID', DEFAULT_CHAIN_ID),
    apiBaseUrl: strOr(
      env,
      'AGENT_API_BASE_URL',
      strOr(env, 'VITE_API_BASE_URL', 'http://localhost:8080'),
    ),
  }
  const groqApiKey = env.GROQ_API_KEY
  if (groqApiKey) config.groqApiKey = groqApiKey
  const agentWalletKey = env.AGENT_WALLET_KEY
  if (agentWalletKey) config.agentWalletKey = agentWalletKey
  const rpcUrl = env.BASE_SEPOLIA_RPC_URL
  if (rpcUrl) config.rpcUrl = rpcUrl
  const policyRegistry = env.POLICY_REGISTRY_ADDRESS
  if (policyRegistry) config.policyRegistryAddress = policyRegistry
  const anchor = env.ANCHOR_CONTRACT_ADDRESS
  if (anchor) config.anchorAddress = anchor
  const runSecret = env.SENTINEL_RUN_SECRET ?? env.CRON_SECRET
  if (runSecret) config.runSecret = runSecret
  return config
}

export { DEFAULT_MODEL as AGENT_DEFAULT_MODEL }

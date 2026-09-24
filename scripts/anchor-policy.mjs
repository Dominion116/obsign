// Anchor a policy hash on Base Sepolia via ObsignPolicyRegistry.registerPolicy.
//
// policyHash = keccak256(utf8(JCS(policy))) — the same JCS/keccak the protocol
// uses for credentials, so the agent recomputes an identical hash at runtime.
//
// RULE-1: this SIGNS and BROADCASTS a transaction. Run it in ops/CI with a funded
// testnet wallet, never in a local build. It imports the BUILT SDK dist (run
// `npm run build:sdk` first), matching the other scripts' consume-the-shipped-
// bytes pattern.
//
// Usage:  node scripts/anchor-policy.mjs policies/attendance-v1.json
// Env:    BASE_SEPOLIA_RPC_URL, AGENT_WALLET_KEY (testnet only), POLICY_REGISTRY_ADDRESS

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

function fail(msg) {
  console.error(`[anchor-policy] FAIL: ${msg}`)
  process.exit(1)
}

const policyArg = process.argv[2]
if (!policyArg) fail('usage: node scripts/anchor-policy.mjs <policy.json>')

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL
const walletKey = process.env.AGENT_WALLET_KEY
const registry = process.env.POLICY_REGISTRY_ADDRESS
if (!rpcUrl || !walletKey || !registry) {
  fail('BASE_SEPOLIA_RPC_URL, AGENT_WALLET_KEY, and POLICY_REGISTRY_ADDRESS are required')
}

const sdkEntry = join(repoRoot, 'packages', 'sdk', 'dist', 'index.js')
const { canonicalBytes, keccak256Hex, policyRegistryAbi } = await import(
  pathToFileURL(sdkEntry).href
).catch((err) =>
  fail(`could not import built SDK at ${sdkEntry} (run npm run build:sdk): ${err.message}`),
)

const { createWalletClient, createPublicClient, http } = await import('viem')
const { privateKeyToAccount } = await import('viem/accounts')
const { baseSepolia } = await import('viem/chains')

const policyPath = resolve(repoRoot, policyArg)
const policy = JSON.parse(readFileSync(policyPath, 'utf8'))
const policyHash = keccak256Hex(canonicalBytes(policy))
console.log(`[anchor-policy] ${policy.id} v${policy.version} → policyHash ${policyHash}`)

const account = privateKeyToAccount(walletKey)
const transport = http(rpcUrl)
const publicClient = createPublicClient({ chain: baseSepolia, transport })
const wallet = createWalletClient({ account, chain: baseSepolia, transport })

const already = await publicClient.readContract({
  address: registry,
  abi: policyRegistryAbi,
  functionName: 'isRegistered',
  args: [policyHash],
})

let txHash = null
if (already) {
  console.log('[anchor-policy] already registered — no transaction sent')
} else {
  txHash = await wallet.writeContract({
    address: registry,
    abi: policyRegistryAbi,
    functionName: 'registerPolicy',
    args: [policyHash],
  })
  await publicClient.waitForTransactionReceipt({ hash: txHash })
  console.log(`[anchor-policy] registered in tx ${txHash}`)
}

// Record the result in policies/deployments.json.
const deploymentsPath = join(repoRoot, 'policies', 'deployments.json')
const deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8'))
deployments.policies = (deployments.policies ?? []).filter((p) => p.policyHash !== policyHash)
deployments.policies.push({
  id: policy.id,
  version: policy.version,
  policyHash,
  txHash,
  registrant: account.address,
  anchoredAt: new Date().toISOString(),
})
writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2) + '\n', 'utf8')
console.log('[anchor-policy] updated policies/deployments.json')

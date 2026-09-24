// Runtime wiring: build a ready-to-run VettingDeps from AgentConfig. This is the
// seam between configuration/environment and the pure loop. Simulation mode uses
// the SDK's offline verifier (no backend, no payment, no wallet) yet returns a
// real receipt; live mode uses the REST/x402 client and a funded wallet.

import { ObsignClient, verifyOffline, type FetchLike, type OfflineVerifyOptions } from '@obsign/sdk'
import type { Address } from 'viem'
import { createLlmProvider } from './llm.js'
import { createAgentWallet, type AgentWallet } from './wallet.js'
import { payAndVerify, type PayAndVerifyResult } from './verify.js'
import { InMemoryStore, type MemoryStore } from './memory.js'
import type { AgentConfig } from './config.js'
import type { Policy } from './policy.js'
import type { VettingDeps, VettingSubject } from './agent.js'

export interface BuildDepsOptions {
  policy: Policy
  /** The subject's credential + evidence (preloaded). */
  subject: VettingSubject
  mode: 'live' | 'simulation'
  /** Pinned inputs for simulation offline verification. */
  offline?: OfflineVerifyOptions
  memory?: MemoryStore
  fetchImpl?: FetchLike
}

/** True when every capability a live run needs is configured. */
export function canRunLive(config: AgentConfig): boolean {
  return Boolean(
    config.agentWalletKey && config.rpcUrl && config.policyRegistryAddress && config.anchorAddress,
  )
}

/** Construct the loop dependencies for a run. */
export function buildVettingDeps(config: AgentConfig, opts: BuildDepsOptions): VettingDeps {
  let wallet: AgentWallet | null = null
  if (opts.mode === 'live' && canRunLive(config)) {
    wallet = createAgentWallet({
      privateKey: config.agentWalletKey as string,
      rpcUrl: config.rpcUrl as string,
      policyRegistry: config.policyRegistryAddress as Address,
      anchor: config.anchorAddress as Address,
    })
  }

  const verify = async (subject: VettingSubject): Promise<PayAndVerifyResult> => {
    if (opts.mode === 'simulation') {
      const offline = opts.offline ?? { now: new Date().toISOString() }
      const receipt = verifyOffline(subject.credential, subject.evidence, offline)
      // paid:true so the trace narrates the (simulated) x402 payment step.
      return { kind: 'verified', receipt, paid: true }
    }
    const client = new ObsignClient({
      baseUrl: config.apiBaseUrl,
      ...(opts.fetchImpl ? { fetch: opts.fetchImpl } : {}),
    })
    return payAndVerify({
      client,
      wallet,
      credential: subject.credential,
      evidence: subject.evidence,
    })
  }

  return {
    policy: opts.policy,
    llm: createLlmProvider(config),
    loadSubject: async () => opts.subject,
    verify,
    wallet,
    memory: opts.memory ?? new InMemoryStore(),
    mode: opts.mode,
  }
}

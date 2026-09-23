// Composition root for the API. Wires @obsign/platform infra + the @obsign/worker
// handlers into a single context object the routes close over. Nothing here
// holds issuer keys (INV-7); Mongo is cache only (INV-4).

import type { Db } from 'mongodb'
import {
  ChainIndexer,
  CredentialService,
  GridFSEvidenceStore,
  LeaseQueue,
  SiweService,
  collections,
  createMongoNonceStore,
  createRepositories,
  evidenceBucket,
  type PlatformConfig,
  type Repositories,
} from '@obsign/platform'
import { buildWorkerDeps, type WorkerDeps } from '@obsign/worker'

export interface AppContext {
  config: PlatformConfig
  repos: Repositories
  queue: LeaseQueue
  siwe: SiweService
  evidence: GridFSEvidenceStore
  indexer: ChainIndexer
  credentials: CredentialService
  worker: WorkerDeps
}

/** Build the full application context from a live Db + config. */
export function buildContext(db: Db, config: PlatformConfig): AppContext {
  const repos = createRepositories(db)
  const queue = new LeaseQueue(collections(db).queue)

  const origin = new URL(config.frontendOrigin)
  const siwe = new SiweService({
    nonces: createMongoNonceStore(collections(db).siweNonces),
    domain: origin.host,
    uri: origin.origin,
    chainId: config.chainId,
    jwtSecret: config.sessionJwtSecret,
  })

  const evidence = new GridFSEvidenceStore(evidenceBucket(db), config.evidenceMaxBytes)
  const indexer = new ChainIndexer({
    rpcUrl: config.rpcUrl,
    addresses: {
      anchor: config.anchorAddress as `0x${string}`,
      revocation: config.revocationAddress as `0x${string}`,
      issuerRegistry: config.issuerRegistryAddress as `0x${string}`,
      policyRegistry: config.policyRegistryAddress as `0x${string}`,
    },
    minConfirmations: config.anchorMinConfirmations,
  })
  const credentials = new CredentialService(repos, queue)
  const worker = buildWorkerDeps(db, config)

  return { config, repos, queue, siwe, evidence, indexer, credentials, worker }
}

// Public surface of @obsign/platform. Framework-agnostic domain + infra used by
// apps/api and apps/worker. All impure I/O (Mongo, network, env, clock) lives in
// this package or the apps — never in @obsign/core (INV-1).

export * from './types.js'
export * from './config.js'
export {
  getMongoClient,
  closeMongoClient,
  collections,
  evidenceBucket,
  ensureIndexes,
  SIWE_NONCE_TTL_SECONDS,
  type Collections,
} from './mongo.js'
export * from './repositories/index.js'
export * from './queue.js'
export * from './evidence-store.js'
export * from './payment-proof-store.js'
export * from './siwe.js'
export * from './chain-indexer.js'
export * from './credential-service.js'

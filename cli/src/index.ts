#!/usr/bin/env node
// obsign CLI — verifies a credential + evidence and emits a receipt whose
// derived truth (receiptId, credentialHash, evidenceHash, result, reasonCode) is
// byte-identical to @obsign/core. The CLI only adds transport (file I/O, arg
// parsing) and non-hashed metadata; it never re-implements verification.
//
// Usage:
//   obsign verify --credential c.json --evidence e.json [--chain <rpc>]
//                 [--offline] [--context ctx.json] [--out receipt.json]

import { readFileSync, writeFileSync } from 'node:fs'
import {
  buildReceipt,
  chainReaderFromFixture,
  evidenceStoreFromFixture,
  issuerRegistryFromFixture,
  type ChainReader,
  type VerificationContext,
} from '@obsign/core'
import {
  createChainClient,
  createChainReader,
  type OnchainEventRef,
  type SnapshotRequest,
} from '@obsign/sdk'

interface Args {
  credential?: string
  evidence?: string
  context?: string
  chain?: string
  offline?: boolean
  out?: string
  now?: string
  help?: boolean
}

export function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = '', ...rest] = argv
  const args: Args = {}
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]
    switch (token) {
      case '--credential':
      case '-c':
        args.credential = rest[++i]
        break
      case '--evidence':
      case '-e':
        args.evidence = rest[++i]
        break
      case '--context':
        args.context = rest[++i]
        break
      case '--chain':
        args.chain = rest[++i]
        break
      case '--offline':
        args.offline = true
        break
      case '--out':
      case '-o':
        args.out = rest[++i]
        break
      case '--now':
        args.now = rest[++i]
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        throw new Error(`unknown argument: ${token}`)
    }
  }
  return { command, args }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

const USAGE = `obsign verify — recompute a verifiable receipt

Usage:
  obsign verify --credential <file> --evidence <file> [options]

Options:
  -c, --credential <file>  Credential JSON (required)
  -e, --evidence <file>    Evidence JSON (required)
      --context <file>     Injected context fixture { now, chain, artifacts, registry }
      --chain <rpc>        Base Sepolia RPC endpoint for a live pinned read (SDK)
      --offline            Do not attempt any network reads (fixtures only)
      --now <iso>          Override verification instant (ISO-8601 UTC ms)
  -o, --out <file>         Write the receipt JSON to <file> (default: stdout)
  -h, --help               Show this help
`

interface ContextFixture {
  now?: string
  chain?: Parameters<typeof chainReaderFromFixture>[0]
  artifacts?: Parameters<typeof evidenceStoreFromFixture>[0]
  registry?: Parameters<typeof issuerRegistryFromFixture>[0]
  issuerSignature?: string
  authorizedSigners?: string[]
}

/**
 * Build the verification context from an optional fixture + CLI overrides. When
 * `liveChain` is supplied (the SDK live reader), it replaces the fixture reader;
 * otherwise the pinned fixture reader is used. The result is always a synchronous
 * ChainReader, so verification stays pure and pinned regardless of source.
 */
export function buildContext(
  fixture: ContextFixture,
  args: Args,
  liveChain?: ChainReader,
): VerificationContext {
  const now = args.now ?? fixture.now
  if (typeof now !== 'string') {
    throw new Error('a verification instant is required (--now or context.now)')
  }
  const ctx: VerificationContext = {
    now,
    chain: liveChain ?? chainReaderFromFixture(fixture.chain),
    store: evidenceStoreFromFixture(fixture.artifacts),
  }
  const registry = issuerRegistryFromFixture(fixture.registry)
  if (registry) ctx.registry = registry
  if (typeof fixture.issuerSignature === 'string') ctx.issuerSignature = fixture.issuerSignature
  if (Array.isArray(fixture.authorizedSigners)) ctx.authorizedSigners = fixture.authorizedSigners
  return ctx
}

/** Extract onchain-event coordinates from evidence for a live snapshot fetch. */
export function onchainEventRefs(evidence: unknown): OnchainEventRef[] {
  const items = Array.isArray(evidence) ? evidence : [evidence]
  const refs: OnchainEventRef[] = []
  for (const item of items) {
    const e = item as Record<string, unknown>
    if (e?.kind !== 'onchain-event') continue
    if (
      typeof e.blockNumber === 'number' &&
      typeof e.txHash === 'string' &&
      typeof e.logIndex === 'number' &&
      typeof e.address === 'string'
    ) {
      refs.push({
        blockNumber: e.blockNumber,
        txHash: e.txHash,
        logIndex: e.logIndex,
        address: e.address,
      })
    }
  }
  return refs
}

/** Parse + validate args and load inputs, or return a nonzero exit code. */
function prepare(
  argv: string[],
):
  | { code: number }
  | { credential: unknown; evidence: unknown; fixture: ContextFixture; args: Args } {
  let parsed: { command: string; args: Args }
  try {
    parsed = parseArgs(argv)
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${USAGE}`)
    return { code: 2 }
  }
  const { command, args } = parsed

  if (args.help || command === '' || command === 'help') {
    process.stdout.write(USAGE)
    return { code: command === '' ? 2 : 0 }
  }
  if (command !== 'verify') {
    process.stderr.write(`unknown command: ${command}\n\n${USAGE}`)
    return { code: 2 }
  }
  if (!args.credential || !args.evidence) {
    process.stderr.write(`--credential and --evidence are required\n\n${USAGE}`)
    return { code: 2 }
  }
  if (args.chain && args.offline) {
    process.stderr.write(`--chain and --offline are mutually exclusive\n\n${USAGE}`)
    return { code: 2 }
  }

  const credential = readJson(args.credential)
  const evidence = readJson(args.evidence)
  const fixture: ContextFixture = args.context ? (readJson(args.context) as ContextFixture) : {}
  if (args.offline) {
    // Offline mode drops any live chain hints; only pinned fixtures are used.
    fixture.chain = fixture.chain ?? { revoked: [] }
  }
  return { credential, evidence, fixture, args }
}

/** Emit the receipt (stdout or --out) and return the verdict exit code. */
function emit(receipt: ReturnType<typeof buildReceipt>, args: Args): number {
  const output = JSON.stringify(receipt, null, 2) + '\n'
  if (args.out) {
    writeFileSync(args.out, output)
    process.stdout.write(`${receipt.result} ${receipt.reasonCode} ${receipt.receiptId}\n`)
  } else {
    process.stdout.write(output)
  }
  return receipt.result === 'valid' ? 0 : 1
}

/**
 * Synchronous verify over fixtures only (no `--chain`). Kept sync so embedders
 * and tests can call it directly; the live path is `runCli`.
 */
export function run(argv: string[]): number {
  const p = prepare(argv)
  if ('code' in p) return p.code
  const ctx = buildContext(p.fixture, p.args)
  return emit(buildReceipt(p.credential, p.evidence, ctx), p.args)
}

/**
 * Async entrypoint. Identical to `run` for the fixture/offline path; when
 * `--chain <rpc>` is given it fetches a pinned snapshot via @obsign/sdk and
 * injects the resulting synchronous ChainReader (INV-1/INV-6 preserved).
 */
export async function runCli(argv: string[]): Promise<number> {
  const p = prepare(argv)
  if ('code' in p) return p.code
  const { credential, evidence, fixture, args } = p

  if (!args.chain) {
    const ctx = buildContext(fixture, args)
    return emit(buildReceipt(credential, evidence, ctx), args)
  }

  let liveChain: ChainReader
  try {
    const client = createChainClient({ rpcUrl: args.chain })
    const request: SnapshotRequest = { events: onchainEventRefs(evidence) }
    const c = credential as Record<string, unknown>
    if (typeof c.credentialId === 'string' && typeof c.issuer === 'string') {
      request.credentials = [{ credentialId: c.credentialId, issuer: c.issuer }]
    }
    liveChain = await createChainReader({
      client,
      addresses: { revocation: resolveRevocationAddress() },
      request,
    })
  } catch (e) {
    process.stderr.write(`live chain read failed: ${(e as Error).message}\n`)
    return 3
  }

  const ctx = buildContext(fixture, args, liveChain)
  return emit(buildReceipt(credential, evidence, ctx), args)
}

/** Resolve the revocation contract address from the environment. */
function resolveRevocationAddress(): `0x${string}` {
  const addr = process.env.REVOCATION_CONTRACT_ADDRESS
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    throw new Error(
      'REVOCATION_CONTRACT_ADDRESS is unset or invalid; set it (see deployments/84532.json) to use --chain',
    )
  }
  return addr as `0x${string}`
}

// Locate this module's entry within process.argv. Works whether argv[1] is node,
// the vite-node loader, or the script itself; returns -1 when we were imported
// (argv holds the test runner, not this file), so auto-run stays off in tests.
function selfArgvIndex(): number {
  return process.argv.findIndex((a) => {
    const p = a.replace(/\\/g, '/')
    return p.endsWith('cli/src/index.ts') || p.endsWith('cli/src/index.js')
  })
}

// User args start after our entry; strip a leading `--` passthrough separator.
function userArgs(selfIdx: number): string[] {
  const args = process.argv.slice(selfIdx + 1)
  return args[0] === '--' ? args.slice(1) : args
}

const selfIdx = selfArgvIndex()
if (selfIdx >= 0) {
  runCli(userArgs(selfIdx)).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`${(e as Error).message}\n`)
      process.exit(3)
    },
  )
}

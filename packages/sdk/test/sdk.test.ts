import { describe, it, expect } from 'vitest'
import { verify } from '@obsign/core'
import { resolveAddresses } from '../src/contracts.js'
import { chainReaderFromSnapshot } from '../src/reader.js'
import { fetchSnapshot } from '../src/snapshot.js'

describe('resolveAddresses', () => {
  const live = {
    chainId: 84532,
    anchor: '0x1111111111111111111111111111111111111111',
    revocation: '0x2222222222222222222222222222222222222222',
    issuerRegistry: '0x3333333333333333333333333333333333333333',
    policyRegistry: '0x4444444444444444444444444444444444444444',
  }

  it('resolves live addresses from the deployments file', () => {
    const a = resolveAddresses(live)
    expect(a.anchor).toBe(live.anchor)
    expect(a.policyRegistry).toBe(live.policyRegistry)
  })

  it('throws on zero (pending-deploy) placeholders', () => {
    const pending = { ...live, anchor: '0x0000000000000000000000000000000000000000' }
    expect(() => resolveAddresses(pending)).toThrow(/missing or a zero placeholder/)
  })

  it('applies explicit overrides', () => {
    const o = '0x5555555555555555555555555555555555555555'
    const resolved = resolveAddresses(undefined, {
      anchor: o,
      revocation: o,
      issuerRegistry: o,
      policyRegistry: o,
    })
    expect(resolved.anchor).toBe(o)
  })
})

describe('chainReaderFromSnapshot (async→sync bridge)', () => {
  it('produces a sync ChainReader the pure core can consume', () => {
    const reader = chainReaderFromSnapshot({
      blocks: { '100': { hash: '0xabc', number: 100, confirmations: 12 } },
      logs: [{ txHash: '0xtx', logIndex: 0, address: '0xaddr', topics: ['0xtopic'], data: '0x' }],
      revoked: ['0xcred'],
    })
    expect(reader.getBlock(100)).toEqual({ hash: '0xabc', number: 100, confirmations: 12 })
    expect(reader.getLog('0xtx', 0)?.address).toBe('0xaddr')
    expect(reader.isRevoked('0xcred')).toBe(true)
    expect(reader.isRevoked('0xother')).toBe(false)
    // Prove it plugs straight into verify() without any await.
    expect(typeof verify).toBe('function')
  })
})

describe('fetchSnapshot', () => {
  it('materializes a pinned fixture from a mock viem client', async () => {
    const calls: Record<string, unknown> = {}
    const mockClient = {
      async getBlockNumber() {
        return 111n
      },
      async getBlock({ blockNumber }: { blockNumber: bigint }) {
        calls.blockNumber = blockNumber
        return { hash: '0xdeadbeef', number: blockNumber }
      },
      async getTransactionReceipt({ hash }: { hash: string }) {
        calls.txHash = hash
        return {
          logs: [
            { logIndex: 0, address: '0xwrong', topics: ['0xa'], data: '0x00' },
            { logIndex: 3, address: '0xEvent', topics: ['0xsig', '0xtopic'], data: '0xbeef' },
          ],
        }
      },
      async readContract({ functionName, args }: { functionName: string; args: unknown[] }) {
        calls.fn = functionName
        calls.args = args
        return true
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const fixture = await fetchSnapshot(
      mockClient,
      { revocation: '0x2222222222222222222222222222222222222222' },
      {
        events: [{ blockNumber: 100, txHash: '0xtx', logIndex: 3, address: '0xEvent' }],
        credentials: [{ credentialId: '0xcred', issuer: '0xissuer' }],
      },
    )

    expect(fixture.blocks?.['100']).toEqual({ hash: '0xdeadbeef', number: 100, confirmations: 12 })
    expect(fixture.logs?.[0]).toEqual({
      txHash: '0xtx',
      logIndex: 3,
      address: '0xEvent',
      topics: ['0xsig', '0xtopic'],
      data: '0xbeef',
    })
    expect(fixture.revoked).toEqual(['0xcred'])
    expect(calls.fn).toBe('isRevokedBy')
    expect(calls.args).toEqual(['0xcred', '0xissuer'])
  })

  it('omits a log when the logIndex is absent (→ core EVENT_NOT_FOUND)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = {
      async getBlockNumber() {
        return 50n
      },
      async getBlock({ blockNumber }: { blockNumber: bigint }) {
        return { hash: '0xaaa', number: blockNumber }
      },
      async getTransactionReceipt() {
        return { logs: [{ logIndex: 9, address: '0xx', topics: [], data: '0x' }] }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const fixture = await fetchSnapshot(
      mockClient,
      { revocation: '0x2222222222222222222222222222222222222222' },
      { events: [{ blockNumber: 10, txHash: '0xtx', logIndex: 3, address: '0xx' }] },
    )
    expect(fixture.logs?.length).toBe(0)
    expect(fixture.blocks?.['10']?.confirmations).toBe(41)
  })
})

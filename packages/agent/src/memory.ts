// Run memory (FR-6 "memory across steps"). Each run and its steps are persisted
// so a decision is auditable and resumable. The default is in-memory; a file
// store is provided for durability. A Mongo-backed store can implement the same
// interface later (`vetting_runs`) without touching the agent loop.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SentinelStep } from './steps.js'

export interface VettingRunRecord {
  runId: string
  subject: string
  claim: string
  policyId: string
  policyHash: string
  startedAt: string
  steps: SentinelStep[]
  decision?: 'grant' | 'deny'
  reasonCode?: string
  satisfied?: boolean
  finishedAt?: string
}

export interface RunOutcome {
  decision: 'grant' | 'deny'
  reasonCode: string
  satisfied: boolean
}

export interface MemoryStore {
  create(record: Omit<VettingRunRecord, 'steps'>): Promise<void>
  appendStep(runId: string, step: SentinelStep): Promise<void>
  finish(runId: string, outcome: RunOutcome): Promise<void>
  get(runId: string): Promise<VettingRunRecord | null>
}

/** Process-local store. Sufficient for a single live trace and for tests. */
export class InMemoryStore implements MemoryStore {
  private readonly runs = new Map<string, VettingRunRecord>()

  async create(record: Omit<VettingRunRecord, 'steps'>): Promise<void> {
    this.runs.set(record.runId, { ...record, steps: [] })
  }
  async appendStep(runId: string, step: SentinelStep): Promise<void> {
    this.runs.get(runId)?.steps.push(step)
  }
  async finish(runId: string, outcome: RunOutcome): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return
    run.decision = outcome.decision
    run.reasonCode = outcome.reasonCode
    run.satisfied = outcome.satisfied
    run.finishedAt = new Date().toISOString()
  }
  async get(runId: string): Promise<VettingRunRecord | null> {
    return this.runs.get(runId) ?? null
  }
}

/** Durable store: one JSON file per run under `dir`. */
export class FileMemoryStore implements MemoryStore {
  constructor(private readonly dir: string) {}

  private file(runId: string): string {
    return join(this.dir, `${runId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`)
  }

  private async read(runId: string): Promise<VettingRunRecord | null> {
    try {
      return JSON.parse(await readFile(this.file(runId), 'utf8')) as VettingRunRecord
    } catch {
      return null
    }
  }

  private async persist(record: VettingRunRecord): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file(record.runId), JSON.stringify(record, null, 2), 'utf8')
  }

  async create(record: Omit<VettingRunRecord, 'steps'>): Promise<void> {
    await this.persist({ ...record, steps: [] })
  }
  async appendStep(runId: string, step: SentinelStep): Promise<void> {
    const run = await this.read(runId)
    if (!run) return
    run.steps.push(step)
    await this.persist(run)
  }
  async finish(runId: string, outcome: RunOutcome): Promise<void> {
    const run = await this.read(runId)
    if (!run) return
    run.decision = outcome.decision
    run.reasonCode = outcome.reasonCode
    run.satisfied = outcome.satisfied
    run.finishedAt = new Date().toISOString()
    await this.persist(run)
  }
  async get(runId: string): Promise<VettingRunRecord | null> {
    return this.read(runId)
  }
}

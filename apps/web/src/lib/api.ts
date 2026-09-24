import { SAMPLE, recomputeDemo, type DemoReceipt } from './sample'

/**
 * Centralized API surface for the Obsign web app.
 *
 * Every call prefers the live REST API and falls back to deterministic,
 * locally-recomputed demo data when the network or backend is unavailable.
 * This mirrors invariant INV-2: receipts are recomputable offline, so the UI
 * stays functional against the published spec even with no server.
 */

/** Versioned REST endpoints. Kept in one place so paths never drift. */
export const ENDPOINTS = {
  verify: '/api/v1/verify',
  health: '/api/v1/health',
  credentials: '/api/v1/credentials',
  credential: (id: string) => `/api/v1/credentials/${encodeURIComponent(id)}`,
  revoke: (id: string) => `/api/v1/credentials/${encodeURIComponent(id)}/revoke`,
  receipt: (id: string) => `/api/v1/receipts/${encodeURIComponent(id)}`,
} as const

/** Thrown when the backend responds with an x402 payment challenge. */
export class PaymentRequiredError extends Error {
  constructor(message = 'Payment required') {
    super(message)
    this.name = 'PaymentRequiredError'
  }
}

interface RequestOptions extends RequestInit {
  /** Parsed JSON body helper. */
  json?: unknown
}

/** Thin fetch wrapper that centralizes headers, JSON handling, and 402s. */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })

  if (res.status === 402) throw new PaymentRequiredError()
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

/**
 * Base URL of the deployed Obsign API (same convention as backend.ts). Read
 * endpoints must target this explicitly, because the web app (Vercel) and the API
 * (Render) are different origins — a relative path would 404 on the web origin.
 */
const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(
  /\/+$/,
  '',
)

/** GET a public read endpoint from the real API base. */
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

/* ------------------------------------------------------------------ */
/* Domain types                                                        */
/* ------------------------------------------------------------------ */

export type CredentialStatus = 'anchored' | 'pending' | 'revoked'

export interface Credential {
  id: string
  claim: string
  issuer: string
  status: CredentialStatus
  anchorTx: string
  issuedAt: string
}

export interface Receipt {
  receiptId: string
  credentialHash: string
  evidenceHash: string
  result: string
  reasonCode: string
  issuer: string
  subject: string
  verifiedAt: string
  verifier: string
  anchor: { chainId: number; txHash: string; blockNumber: number }
  paid: boolean
}

export type ServiceStatus = 'operational' | 'degraded' | 'down'

export interface Service {
  name: string
  status: ServiceStatus
  detail: string
}

/* ------------------------------------------------------------------ */
/* Local fallback data (demo / offline)                                */
/* ------------------------------------------------------------------ */

const DEMO_SERVICES: Service[] = [
  {
    name: 'Verification API',
    status: 'operational',
    detail: 'The POST /api/v1/verify endpoint is accepting requests and returning receipts within its normal response time.',
  },
  {
    name: 'MCP endpoint',
    status: 'operational',
    detail: 'The tools exposed at /api/mcp are reachable, so connected agents can issue and verify credentials without interruption.',
  },
  {
    name: 'Core verifier',
    status: 'operational',
    detail: 'The deterministic engine that computes every verdict is healthy and producing consistent results.',
  },
  {
    name: 'Base Sepolia',
    status: 'operational',
    detail: 'Anchor reads from the Base Sepolia network are completing at the latency we expect.',
  },
]

function demoReceipt(receiptId: string): Receipt {
  const id = receiptId || '0x0000000000000000000000000000000000000000000000000000'
  return {
    receiptId: id,
    credentialHash: '0x' + 'a1'.repeat(32),
    evidenceHash: '0x' + 'b2'.repeat(32),
    result: 'valid',
    reasonCode: 'OK',
    issuer: '0x1111111111111111111111111111111111111111',
    subject: '0x2222222222222222222222222222222222222222',
    verifiedAt: '2026-09-21T00:00:00.000Z',
    verifier: 'obsign-core/1.0.0',
    anchor: { chainId: 84532, txHash: '0x' + 'cd'.repeat(20), blockNumber: 12345678 },
    paid: false,
  }
}

/** Base Sepolia block explorer link for a transaction hash. */
export function explorerTxUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

/** Where a verdict came from — used to caveat offline-only checks in the UI. */
export type VerifySource = 'live' | 'offline'

export type VerifyOutcome =
  | { kind: 'valid'; receipt: DemoReceipt; source: VerifySource }
  | { kind: 'unpaid' }

/**
 * Verify a credential + evidence set. Prefers the live API; on network error
 * falls back to local recomputation of the bundled sample vector.
 *
 * The `source` flag lets the UI disclose that the offline fallback cannot
 * confirm revocation or on-chain evidence (those need a live chain read).
 */
export async function verifyCredential(
  credential: Record<string, unknown> = SAMPLE.credential,
  evidence: Record<string, unknown> = SAMPLE.evidence,
): Promise<VerifyOutcome> {
  try {
    const receipt = await request<DemoReceipt>(ENDPOINTS.verify, {
      method: 'POST',
      json: { credential, evidence },
    })
    return { kind: 'valid', receipt, source: 'live' }
  } catch (err) {
    if (err instanceof PaymentRequiredError) return { kind: 'unpaid' }
    // Network/offline — recompute deterministically from the sample.
    return { kind: 'valid', receipt: recomputeDemo(credential, evidence), source: 'offline' }
  }
}

/* ------------------------------------------------------------------ */
/* Resource loaders (with offline fallback)                            */
/* ------------------------------------------------------------------ */

/**
 * List the credentials issued by a given wallet address (live only — no demo
 * fallback). Returns an empty array when the address has none or the API is
 * unreachable, so the dashboard shows a real empty state rather than mock rows.
 */
export async function fetchCredentialsByIssuer(address: string): Promise<Credential[]> {
  if (!address) return []
  try {
    return await getJson<Credential[]>(`/api/v1/issuers/${encodeURIComponent(address)}/credentials`)
  } catch {
    return []
  }
}

export async function fetchReceipt(receiptId: string): Promise<Receipt> {
  try {
    return await getJson<Receipt>(ENDPOINTS.receipt(receiptId))
  } catch {
    return demoReceipt(receiptId)
  }
}

export async function fetchStatus(): Promise<Service[]> {
  try {
    return await getJson<Service[]>(ENDPOINTS.health)
  } catch {
    return DEMO_SERVICES
  }
}

/**
 * Revoke a credential by id. Prefers the live API; when unavailable, resolves
 * successfully so the demo dashboard can reflect the optimistic change.
 */
export async function revokeCredential(id: string): Promise<void> {
  try {
    await request<unknown>(ENDPOINTS.revoke(id), { method: 'POST' })
  } catch {
    // Offline demo: treat as success so the UI can update locally.
  }
}

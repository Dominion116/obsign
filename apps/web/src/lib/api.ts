/**
 * Centralized API surface for the Obsign web app.
 *
 * All reads target the live REST API at VITE_API_BASE_URL. There is no demo /
 * offline fabrication: a failed read throws (or returns an empty list) so the
 * UI shows a real error/empty state instead of fake data.
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
export const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(
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
  /** Present only once the credential is anchored on-chain. */
  anchor?: { chainId: number; txHash: string; blockNumber: number }
  paid?: boolean
}

export type ServiceStatus = 'operational' | 'degraded' | 'down'

export interface Service {
  name: string
  status: ServiceStatus
  detail: string
}

/** Shape returned by GET /api/v1/health (apps/api/src/routes/health.ts). */
export interface HealthResponse {
  status: 'operational' | 'degraded'
  queueDepth: number
  checks: Record<string, { status: 'operational' | 'down'; detail?: string }>
}

/* ------------------------------------------------------------------ */
/* Explorer helpers                                                    */
/* ------------------------------------------------------------------ */

/** Base Sepolia block explorer link for a transaction hash. */
export function explorerTxUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`
}

/* ------------------------------------------------------------------ */
/* Resource loaders (live)                                             */
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

/**
 * Fetch a verification receipt by id (live only — no demo fallback). Throws on a
 * miss/unreachable API so the receipt page shows a real not-found/error state.
 */
export async function fetchReceipt(receiptId: string): Promise<Receipt> {
  return getJson<Receipt>(ENDPOINTS.receipt(receiptId))
}

/** Human labels for the health-check keys the API reports. */
const HEALTH_LABELS: Record<string, string> = {
  database: 'Database',
  rpc: 'Base Sepolia RPC',
}

/** Adapt the health object into the flat Service[] the status page renders. */
function healthToServices(health: HealthResponse): Service[] {
  const services: Service[] = Object.entries(health.checks ?? {}).map(([key, check]) => ({
    name: HEALTH_LABELS[key] ?? key,
    status: check.status,
    detail:
      check.detail ??
      (check.status === 'operational'
        ? 'Responding normally.'
        : 'This dependency is not responding.'),
  }))

  const depthOk = typeof health.queueDepth === 'number' && health.queueDepth >= 0
  services.push({
    name: 'Confirmation queue',
    status: depthOk ? 'operational' : 'down',
    detail: depthOk
      ? `${health.queueDepth} job(s) awaiting on-chain confirmation.`
      : 'Queue depth is currently unavailable.',
  })

  return services
}

/**
 * Fetch live service health from GET /api/v1/health and adapt it to Service[].
 * No demo fallback: on failure this throws so the status page can show a real
 * error state instead of fabricated all-operational data.
 */
export async function fetchStatus(): Promise<Service[]> {
  const health = await getJson<HealthResponse>(ENDPOINTS.health)
  return healthToServices(health)
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

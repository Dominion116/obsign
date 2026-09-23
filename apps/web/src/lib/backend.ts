// Typed client for the Obsign REST API (apps/api). Base URL comes from
// VITE_API_BASE_URL; the SIWE session JWT is attached as a bearer token.

const BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')

const SESSION_KEY = 'obsign.session'

export function getSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(SESSION_KEY, token)
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

async function api<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (auth) {
    const token = getSessionToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${detail || res.statusText}`)
  }
  return (await res.json()) as T
}

export interface NonceResponse {
  nonce: string
}

export interface VerifyResponse {
  token: string
  address: string
}

export interface IssueResponse {
  credentialId: string
  receiptId: string
  credentialHash: string
  evidenceHash: string
  status: string
  paid: boolean
}

export const backend = {
  siweNonce: () => api<NonceResponse>('/api/v1/siwe/nonce'),

  siweVerify: (message: string, signature: string) =>
    api<VerifyResponse>('/api/v1/siwe/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    }),

  createCredential: (body: {
    credential: Record<string, unknown>
    evidence: unknown
    issuerSignature: string
    txHash: string
  }) => api<IssueResponse>('/api/v1/credentials', { method: 'POST', body: JSON.stringify(body) }, true),

  revokeCredential: (id: string, txHash: string) =>
    api<{ credentialId: string; txHash: string }>(
      `/api/v1/credentials/${encodeURIComponent(id)}/revoke`,
      { method: 'POST', body: JSON.stringify({ txHash }) },
      true,
    ),

  uploadEvidence: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const token = getSessionToken()
    const res = await fetch(`${BASE}/api/v1/evidence`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) throw new Error(`Evidence upload failed: ${res.status}`)
    return (await res.json()) as { uri: string; sha256: string; bytes: number }
  },
}

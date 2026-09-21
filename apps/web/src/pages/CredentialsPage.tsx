import { useState } from 'react'
import { Link } from '../lib/router'
import { useAsyncData } from '../lib/useAsyncData'
import { fetchCredentials, revokeCredential, type Credential } from '../lib/api'
import Skeleton from '../components/Skeleton'
import './CredentialsPage.css'

const STATUS_LABEL: Record<Credential['status'], string> = {
  anchored: 'Anchored',
  pending: 'Pending',
  revoked: 'Revoked',
}

const SKELETON_ROWS = 4

export default function CredentialsPage() {
  const { data, loading, setData } = useAsyncData<Credential[]>(fetchCredentials)
  const [revoking, setRevoking] = useState<Record<string, boolean>>({})

  const credentials = data ?? []
  const total = credentials.length
  const anchored = credentials.filter((c) => c.status === 'anchored').length
  const pending = credentials.filter((c) => c.status === 'pending').length

  const onRevoke = async (id: string) => {
    const confirmed = window.confirm(
      'Revoke this credential? Verifiers will return REVOKED for its receipt.',
    )
    if (!confirmed) return

    setRevoking((r) => ({ ...r, [id]: true }))
    // Optimistically flip the row to revoked; the API call reconciles it.
    setData((prev) =>
      (prev ?? []).map((c) => (c.id === id ? { ...c, status: 'revoked', anchorTx: c.anchorTx } : c)),
    )
    try {
      await revokeCredential(id)
    } finally {
      setRevoking((r) => {
        const next = { ...r }
        delete next[id]
        return next
      })
    }
  }

  return (
    <main className="creds">
      <section className="creds__body section">
        <div className="container">
          <div className="creds__hero-row">
            <div>
              <p className="eyebrow">Issuer dashboard</p>
              <h1 className="creds__title">
                Your <span className="script-accent">credentials.</span>
              </h1>
              <p className="creds__lead">
                Issue, track, and revoke credentials. Wallet authentication required to
                publish new ones.
              </p>
            </div>
            <Link className="btn btn--primary creds__new" to="/app/issue">
              + New credential
            </Link>
          </div>

          <div className="creds__stats">
            <div className="creds__stat">
              <span className="creds__stat-num">
                {loading ? <Skeleton width="2ch" height="1.4rem" /> : total}
              </span>
              <span className="creds__stat-label">Total</span>
            </div>
            <div className="creds__stat">
              <span className="creds__stat-num">
                {loading ? <Skeleton width="2ch" height="1.4rem" /> : anchored}
              </span>
              <span className="creds__stat-label">Anchored</span>
            </div>
            <div className="creds__stat">
              <span className="creds__stat-num">
                {loading ? <Skeleton width="2ch" height="1.4rem" /> : pending}
              </span>
              <span className="creds__stat-label">Pending anchor</span>
            </div>
          </div>

          <div className="creds__table-wrap">
            <table className="creds__table">
              <thead>
                <tr>
                  <th>Credential</th>
                  <th>Claim</th>
                  <th>Issuer</th>
                  <th>Status</th>
                  <th>Anchor tx</th>
                  <th>Issued</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody aria-busy={loading}>
                {loading
                  ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                      <tr key={`sk-${i}`} className="creds__row--skeleton">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j}>
                            <Skeleton width={j === 1 ? '80%' : '60%'} height="0.9rem" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : credentials.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <code className="creds__id">{c.id.slice(0, 18)}…</code>
                        </td>
                        <td>{c.claim}</td>
                        <td>
                          <code className="creds__mono">{c.issuer}</code>
                        </td>
                        <td>
                          <span className={`creds__badge creds__badge--${c.status}`}>
                            {STATUS_LABEL[c.status]}
                          </span>
                        </td>
                        <td>
                          {c.status === 'anchored' ? (
                            <code className="creds__mono">{c.anchorTx}</code>
                          ) : (
                            <span className="creds__muted">—</span>
                          )}
                        </td>
                        <td className="creds__muted">
                          {new Date(c.issuedAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="creds__actions">
                            <Link className="creds__link" to={`/app/receipt/${c.id}`}>
                              View
                            </Link>
                            {c.status !== 'revoked' && (
                              <button
                                type="button"
                                className="creds__revoke"
                                onClick={() => void onRevoke(c.id)}
                                disabled={revoking[c.id]}
                              >
                                {revoking[c.id] ? 'Revoking…' : 'Revoke'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          <div className="creds__note">
            <p className="creds__note-body">
              Data shown here is a local demo. Issuer keys never touch this dashboard —
              they live behind the KeyProvider interface (INV-7).
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

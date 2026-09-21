import './CredentialsPage.css'

interface Credential {
  id: string
  claim: string
  issuer: string
  status: 'anchored' | 'pending' | 'revoked'
  anchorTx: string
  issuedAt: string
}

const CREDENTIALS: Credential[] = [
  {
    id: '0xcred00000000000000000000000001',
    claim: 'Attendance — Obsign Hackathon 2026',
    issuer: '0x1111…1111',
    status: 'anchored',
    anchorTx: '0xabcd…',
    issuedAt: '2026-09-13T00:00:00.000Z',
  },
  {
    id: '0xcred00000000000000000000000002',
    claim: 'Role — Workshop Facilitator',
    issuer: '0x1111…1111',
    status: 'anchored',
    anchorTx: '0xef01…',
    issuedAt: '2026-09-14T00:00:00.000Z',
  },
  {
    id: '0xcred00000000000000000000000003',
    claim: 'Membership — Base Builders',
    issuer: '0x1111…1111',
    status: 'pending',
    anchorTx: '—',
    issuedAt: '2026-09-20T00:00:00.000Z',
  },
  {
    id: '0xcred00000000000000000000000004',
    claim: 'Attendance — Migrated Event',
    issuer: '0x1111…1111',
    status: 'revoked',
    anchorTx: '0x2345…',
    issuedAt: '2026-09-01T00:00:00.000Z',
  },
]

const STATUS_LABEL: Record<Credential['status'], string> = {
  anchored: 'Anchored',
  pending: 'Pending',
  revoked: 'Revoked',
}

export default function CredentialsPage() {
  const anchored = CREDENTIALS.filter((c) => c.status === 'anchored').length

  return (
    <main className="creds">
      <section className="creds__hero">
        <div className="container">
          <a className="creds__back" href="/">
            ← Back to home
          </a>
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
            <a className="btn btn--primary creds__new" href="/issue">
              + New credential
            </a>
          </div>
        </div>
      </section>

      <section className="creds__body section">
        <div className="container">
          <div className="creds__stats">
            <div className="creds__stat">
              <span className="creds__stat-num">{CREDENTIALS.length}</span>
              <span className="creds__stat-label">Total</span>
            </div>
            <div className="creds__stat">
              <span className="creds__stat-num">{anchored}</span>
              <span className="creds__stat-label">Anchored</span>
            </div>
            <div className="creds__stat">
              <span className="creds__stat-num">2</span>
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
              <tbody>
                {CREDENTIALS.map((c) => (
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
                        <a className="creds__link" href={`/receipt/${c.id}`}>
                          View
                        </a>
                        {c.status !== 'revoked' && (
                          <button type="button" className="creds__revoke">
                            Revoke
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

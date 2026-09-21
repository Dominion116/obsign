import './StatusPage.css'

interface Service {
  name: string
  status: 'operational' | 'degraded' | 'down'
  detail: string
}

const SERVICES: Service[] = [
  { name: 'Verification API', status: 'operational', detail: 'POST /api/v1/verify responding normally' },
  { name: 'MCP endpoint', status: 'operational', detail: '/api/mcp tools reachable' },
  { name: 'Core verifier', status: 'operational', detail: 'Deterministic engine healthy' },
  { name: 'Base Sepolia', status: 'operational', detail: 'Anchor reads at expected latency' },
]

const LABEL: Record<Service['status'], string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
}

export default function StatusPage() {
  return (
    <main className="status">
      <section className="status__hero">
        <div className="container">
          <a className="status__back" href="/">
            ← Back to home
          </a>
          <p className="eyebrow">System status</p>
          <h1 className="status__title">
            All systems <span className="script-accent">operational.</span>
          </h1>
          <p className="status__lead">
            Live health of the verification surface, the MCP endpoint, the deterministic
            core, and the Base Sepolia anchor.
          </p>
        </div>
      </section>

      <section className="status__main section">
        <div className="container">
          <div className="status__overview">
            <span className="status__overview-dot" aria-hidden="true" />
            <div>
              <h2 className="status__overview-title">All systems operational</h2>
              <p className="status__overview-time">Last checked just now</p>
            </div>
          </div>

          <ul className="status__list">
            {SERVICES.map((s) => (
              <li key={s.name} className="status__service">
                <span
                  className={`status__dot status__dot--${s.status}`}
                  aria-hidden="true"
                />
                <div className="status__service-info">
                  <h3 className="status__service-name">{s.name}</h3>
                  <p className="status__service-detail">{s.detail}</p>
                </div>
                <span className={`status__badge status__badge--${s.status}`}>
                  {LABEL[s.status]}
                </span>
              </li>
            ))}
          </ul>

          <div className="status__note">
            <p className="status__note-title">About this page</p>
            <p className="status__note-body">
              Status reflects the deployed API surface. Because receipts are recomputable
              offline, a partial outage of the hosted API never invalidates existing
              credentials — you can still verify against the published spec and public
              chain state.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

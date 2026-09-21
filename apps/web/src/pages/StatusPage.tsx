import { Link } from '../lib/router'
import { useAsyncData } from '../lib/useAsyncData'
import { fetchStatus, type Service } from '../lib/api'
import Skeleton from '../components/Skeleton'
import './StatusPage.css'

const LABEL: Record<Service['status'], string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
}

const SKELETON_ROWS = 4

export default function StatusPage() {
  const { data, loading } = useAsyncData<Service[]>(fetchStatus)
  const services = data ?? []
  const allOperational = !loading && services.every((s) => s.status === 'operational')

  return (
    <main className="status">
      <section className="status__hero">
        <div className="container">
          <Link className="status__back" to="/">
            ← Back to home
          </Link>
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
              <h2 className="status__overview-title">
                {loading
                  ? 'Checking systems…'
                  : allOperational
                    ? 'All systems operational'
                    : 'Some systems need attention'}
              </h2>
              <p className="status__overview-time">
                {loading ? 'Fetching latest health…' : 'Last checked just now'}
              </p>
            </div>
          </div>

          <ul className="status__list" aria-busy={loading}>
            {loading
              ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <li key={`sk-${i}`} className="status__service">
                    <Skeleton variant="circle" width="0.9rem" height="0.9rem" />
                    <div className="status__service-info">
                      <Skeleton width="40%" height="1rem" />
                      <Skeleton width="70%" height="0.8rem" />
                    </div>
                    <Skeleton variant="chip" />
                  </li>
                ))
              : services.map((s) => (
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

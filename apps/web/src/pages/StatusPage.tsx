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
  const { data, loading, error } = useAsyncData<Service[]>(fetchStatus)
  const services = Array.isArray(data) ? data : []
  const allOperational =
    !loading && !error && services.length > 0 && services.every((s) => s.status === 'operational')

  return (
    <main className="status">
      <section className="status__main section">
        <div className="container">
          <div className="status__head">
            <p className="eyebrow">System status</p>
            <h1 className="status__title">
              A live look at <span className="script-accent">every service.</span>
            </h1>
            <p className="status__lead">
              This page reports live readings straight from the verification API&apos;s health
              endpoint: whether its database is reachable, whether the Base Sepolia RPC connection
              it uses to read and anchor on-chain is responding, and how deep the confirmation
              queue that finalizes anchors currently is. Each service is listed below with a short
              note on exactly what is being measured.
            </p>
          </div>

          <div className="status__overview">
            <span className="status__overview-dot" aria-hidden="true" />
            <div>
              <h2 className="status__overview-title">
                {loading
                  ? 'Checking the health of every service right now'
                  : error
                    ? 'We could not reach the status API'
                    : allOperational
                      ? 'Every service is currently operating normally'
                      : 'One or more services currently need attention'}
              </h2>
              <p className="status__overview-time">
                {loading
                  ? 'We are fetching the latest readings for you.'
                  : error
                    ? 'The status service did not respond. Please try again in a moment.'
                    : 'These readings were refreshed a moment ago.'}
              </p>
            </div>
          </div>

          <ul className="status__list" aria-busy={loading} aria-live="polite">
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <li key={`sk-${i}`} className="status__service">
                  <Skeleton variant="circle" width="0.9rem" height="0.9rem" />
                  <div className="status__service-info">
                    <Skeleton width="40%" height="1rem" />
                    <Skeleton width="70%" height="0.8rem" />
                  </div>
                  <Skeleton variant="chip" />
                </li>
              ))
            ) : error ? (
              <li className="status__service">
                <span className="status__dot status__dot--down" aria-hidden="true" />
                <div className="status__service-info">
                  <h3 className="status__service-name">Status unavailable</h3>
                  <p className="status__service-detail">
                    We couldn&apos;t load live service health from the API. This does not affect
                    your credentials, which can always be recomputed offline.
                  </p>
                </div>
                <span className="status__badge status__badge--down">{LABEL.down}</span>
              </li>
            ) : (
              services.map((s) => (
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
              ))
            )}
          </ul>

          <div className="status__note">
            <p className="status__note-title">What this status actually covers</p>
            <p className="status__note-body">
              The readings above describe the health of our hosted API surface and nothing
              more. Because every receipt can be recomputed offline, a partial outage here
              never puts your existing credentials at risk. Even if this service were fully
              unavailable, you could still verify any credential yourself by working
              directly from the published specification and public chain state.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

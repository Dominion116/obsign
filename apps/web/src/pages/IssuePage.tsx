import { Link } from '../lib/router'
import './IssuePage.css'

const CHECKLIST = [
  {
    title: 'Quorum',
    body: 'Collect n-of-m independent signatures over the same message. The credential is only valid once the threshold is met.',
  },
  {
    title: 'Onchain event',
    body: 'Anchor to a pinned transaction or log on Base. Evidence verifies against a specific block — never latest.',
  },
  {
    title: 'Artifact hash',
    body: 'Record the SHA-256 of a fetched artifact. Anyone can recompute and compare the checksum byte-for-byte.',
  },
]

export default function IssuePage() {
  return (
    <main className="issue">
      <section className="issue__main section">
        <div className="container">
          <div className="issue__head">
            <p className="eyebrow">Issue credentials</p>
            <h1 className="issue__title">
              Mint credentials anyone <span className="script-accent">can verify.</span>
            </h1>
            <p className="issue__lead">
              Attach exactly one machine-checkable evidence module to every claim so it
              verifies independently — no trust in your database required.
            </p>
          </div>

          <div className="issue__checklist">
            {CHECKLIST.map((c) => (
              <article key={c.title} className="issue__check">
                <span className="issue__check-icon" aria-hidden="true" />
                <div>
                  <h3 className="issue__check-title">{c.title}</h3>
                  <p className="issue__check-body">{c.body}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="issue__actions">
            <Link className="btn btn--primary" to="/app/verify">
              Verify a credential
            </Link>
            <Link className="btn btn--secondary" to="/app/credentials">
              View issuer dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

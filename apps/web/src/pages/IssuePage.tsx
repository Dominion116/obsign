import { Link } from '../lib/router'
import './IssuePage.css'

const CHECKLIST = [
  {
    title: 'Quorum of signers',
    body: 'Require a set number of independent signatures over one shared message. The credential becomes valid only once that threshold is met.',
  },
  {
    title: 'On-chain event',
    body: 'Tie the claim to a transaction or log on Base, pinned to a fixed block so the evidence resolves the same way for everyone.',
  },
  {
    title: 'Artifact hash',
    body: 'Record a file\u2019s SHA-256 hash so anyone can refetch it, recompute the checksum, and confirm nothing has changed.',
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
              Create credentials that anyone <span className="script-accent">can verify.</span>
            </h1>
            <p className="issue__lead">
              Attach exactly one machine-checkable evidence module to every claim you
              issue, and it will stand on its own for anyone who checks it later. The proof
              travels with the credential itself, so verification never depends on access
              to your database or on anyone trusting the system that produced it.
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

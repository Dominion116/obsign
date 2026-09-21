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

const FLOW = [
  { n: '01', title: 'Compose', body: 'Define the credential and the claim it must prove.' },
  { n: '02', title: 'Attach evidence', body: 'Pick a machine-checkable module: quorum, onchain, or hash.' },
  { n: '03', title: 'Anchor', body: 'Commit the receipt hash on Base for a public, immutable timestamp.' },
]

export default function IssuePage() {
  return (
    <main className="issue">
      <section className="issue__hero">
        <div className="container">
          <Link className="issue__back" to="/">
            ← Back to home
          </Link>
          <p className="eyebrow">Issue credentials</p>
          <h1 className="issue__title">
            Mint credentials anyone <span className="script-accent">can verify.</span>
          </h1>
          <p className="issue__lead">
            Attach machine-checkable evidence to every claim so it verifies independently —
            no trust in your database required.
          </p>
        </div>
      </section>

      <section className="issue__how section">
        <div className="container">
          <div className="issue__how-head">
            <p className="eyebrow">How it works</p>
            <h2 className="section-title">Compose, attach, anchor.</h2>
          </div>
          <ol className="issue__flow">
            {FLOW.map((s) => (
              <li key={s.n} className="issue__flow-step">
                <span className="issue__flow-num" aria-hidden="true">
                  {s.n}
                </span>
                <h3 className="issue__flow-title">{s.title}</h3>
                <p className="issue__flow-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="issue__evidence section">
        <div className="container">
          <div className="issue__evidence-head">
            <p className="eyebrow">Evidence modules</p>
            <h2 className="section-title">Prove it, don&apos;t promise it.</h2>
            <p className="section-lead">
              Choose exactly one machine-checkable module per credential. The verifier
              evaluates it deterministically and returns a fixed reason code.
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
        </div>
      </section>

      <section className="issue__cta section">
        <div className="container">
          <div className="issue__cta-card">
            <h2 className="issue__cta-title">
              The verifier is public. <span className="script-accent">Your data stays yours.</span>
            </h2>
            <p className="issue__cta-lead">
              Issuer keys never touch a database. Key material lives behind the KeyProvider
              interface, and the valid verdict never depends on where the credential was
              issued.
            </p>
            <Link className="btn btn--primary issue__cta-btn" to="/verify">
              Verify a credential
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

import { Link } from '../lib/router'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <main className="nf">
      <section className="nf__card">
        <p className="eyebrow nf__eyebrow">404</p>
        <h1 className="nf__title">
          Nothing to <span className="script-accent">verify here.</span>
        </h1>
        <p className="nf__lead">
          This page doesn&apos;t exist — or it hasn&apos;t been issued yet. Head back to the
          landing page to verify a credential live.
        </p>
        <div className="nf__actions">
          <Link className="btn btn--primary" to="/">
            Back to home
          </Link>
          <Link className="btn btn--secondary" to="/verify">
            Go to Verify
          </Link>
        </div>
      </section>
    </main>
  )
}

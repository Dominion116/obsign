import { Link } from '../lib/router'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <main className="nf">
      <section className="nf__card">
        <p className="eyebrow nf__eyebrow">Error 404</p>
        <h1 className="nf__title">
          There is nothing to <span className="script-accent">verify here.</span>
        </h1>
        <p className="nf__lead">
          The page you were looking for does not exist, or it may point to a credential
          that has not been issued yet. Nothing is broken on your end, so you can pick up
          right where you meant to by returning to the landing page or heading straight to
          the tool that verifies a credential in real time.
        </p>
        <div className="nf__actions">
          <Link className="btn btn--primary" to="/">
            Return to the landing page
          </Link>
          <Link className="btn btn--secondary" to="/app/verify">
            Go to the verification tool
          </Link>
        </div>
      </section>
    </main>
  )
}

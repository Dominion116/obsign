import { Link } from '../lib/router'
import VerifyWidget from './VerifyWidget'
import './Hero.css'

const TRUST = [
  'AI-agent ready through MCP',
  'Built for humans too',
  'Deterministic receipts',
  'x402 payments on Base',
]

export default function Hero() {
  return (
    <section id="top" className="hero">
      <div className="hero__bg" aria-hidden="true">
        <span className="hero__blob hero__blob--one" />
        <span className="hero__blob hero__blob--two" />
      </div>

      <div className="hero__inner container">
        <div className="hero__copy">
          <p className="eyebrow hero__eyebrow">Verification infrastructure for AI agents and humans</p>
          <h1 className="hero__title">
            Give every decision proof it can stand on.{' '}
            <span className="script-accent">For agents and people alike.</span>
          </h1>
          <p className="hero__sub">
            Obsign helps AI agents and humans verify credentials, inspect evidence, and produce
            receipts that anyone can independently recompute before making an important decision.
          </p>
          <div className="hero__ctas">
            <Link className="btn btn--primary" to="/app/verify">
              Verify a credential
            </Link>
            <Link className="btn btn--secondary" to="/app/issue">
              Issue credentials
            </Link>
            {/* <Link className="hero__docs-link" to="/app/docs">
              Read the docs
            </Link> */}
          </div>
          <ul className="hero__trust" aria-label="Highlights">
            {TRUST.map((t) => (
              <li key={t} className="hero__trust-item">
                <span aria-hidden="true" className="hero__trust-dot" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <aside id="verify" className="hero__widget">
          <VerifyWidget />
        </aside>
      </div>
    </section>
  )
}

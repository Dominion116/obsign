import { Link } from '../lib/router'
import VerifyWidget from './VerifyWidget'
import './Hero.css'

const TRUST = ['Built on Base', 'x402 payments', 'MCP-native', 'Open spec']

export default function Hero() {
  return (
    <section id="top" className="hero">
      <div className="hero__bg" aria-hidden="true">
        <span className="hero__blob hero__blob--one" />
        <span className="hero__blob hero__blob--two" />
      </div>

      <div className="hero__inner container">
        <div className="hero__copy">
          <p className="eyebrow">Proof, not promises</p>
          <h1 className="hero__title">
            Credentials anyone <span className="script-accent">can recompute.</span>
          </h1>
          <p className="hero__sub">
            Obsign turns “I was there” or “this is genuine” into a receipt that any
            person, app, or AI agent verifies independently — no trust in our server
            required.
          </p>
          <div className="hero__ctas">
            <Link className="btn btn--primary" to="/app/verify">
              Verify a credential
            </Link>
            <Link className="btn btn--secondary" to="/app/issue">
              Issue credentials
            </Link>
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

import { Link } from '../lib/router'
import VerifyWidget from './VerifyWidget'
import './Hero.css'

const TRUST = [
  'Anchored on Base',
  'Pays over x402',
  'Native MCP support',
  'Fully open specification',
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
          <p className="eyebrow">Proof you can reproduce yourself</p>
          <h1 className="hero__title">
            Credentials anyone <span className="script-accent">can recompute.</span>
          </h1>
          <p className="hero__sub">
            Turn everyday claims into receipts anyone can independently verify.
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

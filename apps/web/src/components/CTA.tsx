import { Link } from '../lib/router'
import './CTA.css'

export default function CTA() {
  return (
    <section id="pricing" className="section cta">
      <div className="container">
        <div className="cta__card">
          <div className="cta__copy">
            <p className="eyebrow cta__eyebrow">Straightforward pricing</p>
            <h2 className="cta__title">
              A flat price for every verification, <span className="script-accent">and no subscriptions.</span>
            </h2>
            <p className="cta__lead">
              Pay a few cents per verification via x402—no accounts or monthly invoices.
              Each call includes a transparent settlement receipt.
            </p>
            <ul className="cta__points">
              <li>Verify without creating an account or signing a contract first.</li>
              <li>Settle payments automatically through native, machine-friendly x402 requests.</li>
              <li>Try everything at no cost while the testnet pilot is running.</li>
            </ul>
            <Link className="btn btn--primary cta__btn" to="/app/verify">
              Verify your first credential
            </Link>
          </div>
          <div className="cta__price">
            <span className="cta__price-label">Price per verification</span>
            <span className="cta__price-amount">$0.01</span>
            <span className="cta__price-note">Paid in USDC on Base at pilot pricing</span>
          </div>
        </div>
      </div>
    </section>
  )
}

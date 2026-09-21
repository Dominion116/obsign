import './CTA.css'

export default function CTA() {
  return (
    <section id="pricing" className="section cta">
      <div className="container">
        <div className="cta__card">
          <div className="cta__copy">
            <p className="eyebrow cta__eyebrow">Pricing</p>
            <h2 className="cta__title">
              Flat price per verification. <span className="script-accent">No subscriptions.</span>
            </h2>
            <p className="cta__lead">
              Pay a few cents per check over x402. No accounts, no invoices — just a
              settlement receipt for every call.
            </p>
            <ul className="cta__points">
              <li>No signup required to verify</li>
              <li>x402 machine-native payments</li>
              <li>Free during the testnet pilot</li>
            </ul>
            <a className="btn btn--on-navy cta__btn" href="/verify">
              Verify your first credential
            </a>
          </div>
          <div className="cta__price">
            <span className="cta__price-label">per verification</span>
            <span className="cta__price-amount">$0.05</span>
            <span className="cta__price-note">USDC on Base · pilot pricing</span>
          </div>
        </div>
      </div>
    </section>
  )
}

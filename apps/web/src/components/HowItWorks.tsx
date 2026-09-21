import { Link } from '../lib/router'
import './HowItWorks.css'

const STEPS = [
  {
    n: '01',
    title: 'Issue the credential',
    body: 'An issuer composes a credential and attaches machine-checkable evidence to it, so the claim carries everything a third party needs to confirm it rather than relying on a signature alone.',
  },
  {
    n: '02',
    title: 'Anchor it on Base',
    body: 'The resulting receipt hash is committed to the Base network, where it becomes a public, tamper-resistant timestamp that proves exactly what was issued and precisely when it happened.',
  },
  {
    n: '03',
    title: 'Verify it anywhere',
    body: 'Anyone can recompute the same receipt offline from the published inputs, which means the verdict never depends on our servers staying online or on any private access to our systems.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section how">
      <div className="container">
        <div className="how__head">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title">
            Issued. Anchored. <span className="script-accent">Verifiable.</span>
          </h2>
        </div>

        <ol className="how__steps">
          {STEPS.map((s) => (
            <li key={s.n} className="how__step">
              <span className="how__num" aria-hidden="true">
                {s.n}
              </span>
              <h3 className="how__title">{s.title}</h3>
              <p className="how__body">{s.body}</p>
            </li>
          ))}
        </ol>

        {/* 
          This diagram will now safely scroll horizontally on small screens 
          instead of breaking apart, and stay centered on desktop.
        */}
        <div className="how__diagram" aria-hidden="true">
          <span className="how__diagram-box how__diagram-box--input">credential</span>
          <span className="how__diagram-plus">+</span>
          <span className="how__diagram-box how__diagram-box--input">evidence</span>
          <span className="how__diagram-arrow">→</span>
          <span className="how__diagram-box how__diagram-box--hash">receiptId</span>
          <span className="how__diagram-arrow">→</span>
          <span className="how__diagram-box how__diagram-box--chain">Base anchor</span>
        </div>
        <Link className="btn btn--primary how__docs-link" to="/app/docs#how-it-works">
          Read the full verification guide
        </Link>
      </div>
    </section>
  )
}

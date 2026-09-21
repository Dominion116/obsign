import './HowItWorks.css'

const STEPS = [
  {
    n: '01',
    title: 'Issue',
    body: 'An issuer mints a credential with machine-checkable evidence attached.',
  },
  {
    n: '02',
    title: 'Anchor',
    body: 'The receipt hash is committed on Base, publicly timestamped and immutable.',
  },
  {
    n: '03',
    title: 'Verify',
    body: 'Anyone recomputes the receipt offline — no trust in our server required.',
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
      </div>
    </section>
  )
}
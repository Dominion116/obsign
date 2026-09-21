import VerifyWidget from '../components/VerifyWidget'
import './VerifyPage.css'

const WHY = [
  {
    title: 'No trust in our server',
    body: 'Obsign never decides for you. The verdict is recomputed from the published spec and public chain state.',
  },
  {
    title: 'Deterministic receipt',
    body: 'The same credential and evidence always yield the same receiptId — offline, on any machine, by anyone.',
  },
  {
    title: 'Machine-checkable proofs',
    body: 'quorum, onchain-event, and artifact-hash evidence each evaluate to a fixed, reasoned verdict.',
  },
]

export default function VerifyPage() {
  return (
    <main className="verify">
      <section className="verify__main section">
        <div className="container">
          <div className="verify__head">
            <p className="eyebrow">Live verify</p>
            <h1 className="verify__title">
              Verify a credential. <span className="script-accent">Anywhere.</span>
            </h1>
            <p className="verify__lead">
              Paste a credential or evidence set and get an independent, recomputable receipt.
              No account, no trust in our server — just the spec, the chain, and your inputs.
            </p>
          </div>

          <div className="verify__grid">
            <div className="verify__widget">
              <VerifyWidget />
            </div>

            <div className="verify__aside">
              <h2 className="verify__aside-title">Why verify with Obsign?</h2>
              <ul className="verify__why">
                {WHY.map((w) => (
                  <li key={w.title} className="verify__why-item">
                    <span className="verify__why-check" aria-hidden="true" />
                    <div>
                      <h3 className="verify__why-title">{w.title}</h3>
                      <p className="verify__why-body">{w.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

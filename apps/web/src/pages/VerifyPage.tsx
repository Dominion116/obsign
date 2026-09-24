import VerifyWidget from '../components/VerifyWidget'
import PaidVerify from '../components/PaidVerify'
import './VerifyPage.css'

const WHY = [
  {
    title: 'You never have to trust our server',
    body: 'Obsign does not hand down a verdict that you are asked to accept on faith. Every result is recomputed from the published specification and public chain state, so you can reach the same conclusion yourself using nothing more than the inputs in front of you.',
  },
  {
    title: 'The same inputs always produce the same receipt',
    body: 'Verification is fully deterministic, which means a given credential and its evidence will always resolve to an identical receipt identifier. That holds true offline, on any machine, and for any person who runs the check, today or years from now.',
  },
  {
    title: 'Every proof is something a machine can check',
    body: 'The quorum, on-chain event, and artifact hash modules each resolve to a fixed verdict paired with a clear reason code. There is no subjective judgment involved, so the outcome is easy to audit and impossible to quietly influence.',
  },
]

export default function VerifyPage() {
  return (
    <main className="verify">
      <section className="verify__main section">
        <div className="container">
          <div className="verify__head">
            <p className="eyebrow">Verify a credential</p>
            <h1 className="verify__title">
              Check any credential, <span className="script-accent">from anywhere.</span>
            </h1>
            <p className="verify__lead">
              Paste a credential or its supporting evidence into the tool below and Obsign
              will return an independent receipt that you can recompute yourself at any
              time. You do not need an account and you do not need to trust our servers,
              because the outcome rests entirely on the published specification, the public
              chain, and the exact inputs you provide.
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

          <PaidVerify />
        </div>
      </section>
    </main>
  )
}

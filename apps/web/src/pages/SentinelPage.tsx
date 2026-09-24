import Skeleton from '../components/Skeleton'
import { explorerTxUrl } from '../lib/api'
import { useEventStream, type SentinelStep } from '../lib/useEventStream'
import './SentinelPage.css'

function Step({ step }: { step: SentinelStep }) {
  return (
    <li className={`sentinel__step sentinel__step--${step.kind}`}>
      <div className="sentinel__step-mark" aria-hidden="true">{step.kind === 'action' ? '✓' : '•'}</div>
      <div className="sentinel__step-copy">
        <h2 className="sentinel__step-title">{step.title}</h2>
        <p>{step.detail}</p>
        {step.reasonCode && <code className="sentinel__code">reasonCode: {step.reasonCode}</code>}
        {step.policyHash && <code className="sentinel__code">policy hash: {step.policyHash}</code>}
        {step.txHash && <a className="sentinel__tx" href={explorerTxUrl(step.txHash)} target="_blank" rel="noreferrer noopener">View BaseScan transaction ↗</a>}
      </div>
    </li>
  )
}

export default function SentinelPage() {
  const { steps, status, restart } = useEventStream()
  const loading = status === 'connecting'
  return (
    <main className="sentinel">
      <section className="sentinel__main section">
        <div className="container">
          <div className="sentinel__head">
            <p className="eyebrow">Sentinel trace</p>
            <h1 className="sentinel__title">Watch a decision become <span className="script-accent">auditable.</span></h1>
            <p className="sentinel__lead">Sentinel records the goal, tools, payment, verification result, policy hash, and final action so an agent decision can be inspected end to end.</p>
          </div>
          <div className="sentinel__toolbar">
            <p className={`sentinel__state sentinel__state--${status}`} aria-live="polite">{status === 'demo' ? 'Demo trace — live endpoint unavailable' : status === 'unpaid' ? 'Payment required before live trace' : status === 'live' ? 'Live stream connected' : status === 'error' ? 'Trace unavailable' : 'Connecting to trace stream…'}</p>
            <button className="btn btn--primary" type="button" onClick={restart}>Replay trace</button>
          </div>
          <ol className="sentinel__feed" aria-busy={loading} aria-live="polite" aria-label="Sentinel decision trace">
            {loading && Array.from({ length: 4 }).map((_, index) => <li className="sentinel__step sentinel__step--loading" key={index}><Skeleton variant="circle" width="1.2rem" height="1.2rem" /><div className="sentinel__step-copy"><Skeleton width="35%" height="1rem" /><Skeleton width="80%" height="0.85rem" /></div></li>)}
            {steps.map((step) => <Step key={step.id} step={step} />)}
            {status === 'unpaid' && <li className="sentinel__payment-note">The live agent requested an x402 payment. No mocked payment is presented as a real transaction.</li>}
          </ol>
        </div>
      </section>
    </main>
  )
}

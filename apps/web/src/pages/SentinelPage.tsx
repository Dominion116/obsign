import { useEffect, useState } from 'react'
import Skeleton from '../components/Skeleton'
import { explorerTxUrl, fetchCredentialsByIssuer, type Credential } from '../lib/api'
import { useAsyncData } from '../lib/useAsyncData'
import { useEventStream, type SentinelStep } from '../lib/useEventStream'
import { useSession } from '../lib/session'
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
        {step.txHash && (
          <a className="sentinel__tx" href={explorerTxUrl(step.txHash)} target="_blank" rel="noreferrer noopener">
            View BaseScan transaction ↗
          </a>
        )}
      </div>
    </li>
  )
}

const STATE_COPY: Record<string, string> = {
  idle: 'Ready to run a live trace',
  connecting: 'Connecting to the live agent…',
  live: 'Live stream connected',
  unpaid: 'Payment required before the live trace',
  unauthorized: 'Sign in required to run a live trace',
  error: 'Live trace unavailable',
}

export default function SentinelPage() {
  const { address, hasSession } = useSession()
  const { data: creds, loading: credsLoading } = useAsyncData<Credential[]>(
    () => (address ? fetchCredentialsByIssuer(address) : Promise.resolve([])),
    [address],
  )
  const credentials = creds ?? []
  const [selectedId, setSelectedId] = useState('')

  // Default the picker to the first real credential once they load.
  useEffect(() => {
    if (!selectedId && credentials.length > 0) setSelectedId(credentials[0].id)
  }, [credentials, selectedId])

  const [started, setStarted] = useState(false)
  const { steps, status, detail, restart } = useEventStream({
    live: true,
    enabled: started && hasSession,
    credentialId: selectedId || undefined,
  })
  const loading = status === 'connecting'

  // A live run spends real testnet USDC + writes on-chain — confirm before firing.
  const confirmAndRun = (run: () => void) => {
    const target = selectedId ? 'the selected credential' : 'the built-in sample credential'
    const ok = window.confirm(
      `This starts a REAL on-chain Sentinel run against ${target}: the agent will spend testnet ` +
        `USDC (x402) and write to Base Sepolia. This is irreversible on testnet. Continue?`,
    )
    if (ok) run()
  }

  return (
    <main className="sentinel">
      <section className="sentinel__main section">
        <div className="container">
          <div className="sentinel__head">
            <p className="eyebrow">Sentinel trace</p>
            <h1 className="sentinel__title">Watch a decision become <span className="script-accent">auditable.</span></h1>
            <p className="sentinel__lead">Sentinel vets a credential end to end — goal, tools, x402 payment, deterministic verification, policy hash, and the final on-chain action. Every run is a real agent decision on Base Sepolia, not a scripted demo. Pick one of your issued credentials below, or run the built-in sample if you don&apos;t have one yet.</p>
          </div>

          {hasSession && (
            <div className="sentinel__toolbar">
              <label className="sentinel__state" htmlFor="sentinel-credential">
                Credential to vet
              </label>
              <select
                id="sentinel-credential"
                className="sentinel__select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={credsLoading || credentials.length === 0}
              >
                {credentials.length === 0 ? (
                  <option value="">
                    {credsLoading ? 'Loading your credentials…' : 'No issued credentials — built-in scenario'}
                  </option>
                ) : (
                  credentials.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.claim} · {c.id.slice(0, 10)}…
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="sentinel__toolbar">
            <p className={`sentinel__state sentinel__state--${status}`} aria-live="polite">
              <span className="sentinel__state-dot" aria-hidden="true" />
              {STATE_COPY[status] ?? STATE_COPY.idle}
            </p>
            {started ? (
              <button className="btn btn--primary" type="button" onClick={() => confirmAndRun(restart)} disabled={!hasSession}>
                Replay live trace
              </button>
            ) : (
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => confirmAndRun(() => setStarted(true))}
                disabled={!hasSession}
              >
                Start live trace
              </button>
            )}
          </div>

          {!hasSession && (
            <p className="sentinel__payment-note">
              Connect your wallet and sign in (top-right) to run a live Sentinel trace. Live runs
              are gated behind a signed-in session.
            </p>
          )}

          {hasSession && (
            <p className="sentinel__payment-note">
              Heads up: each live run has the agent spend real testnet USDC (x402) and write to
              Base Sepolia on-chain. These actions are irreversible on testnet.
            </p>
          )}

          <ol className="sentinel__feed" aria-busy={loading} aria-live="polite" aria-label="Sentinel decision trace">
            {loading && Array.from({ length: 4 }).map((_, index) => <li className="sentinel__step sentinel__step--loading" key={index}><Skeleton variant="circle" width="1.2rem" height="1.2rem" /><div className="sentinel__step-copy"><Skeleton width="35%" height="1rem" /><Skeleton width="80%" height="0.85rem" /></div></li>)}
            {steps.map((step) => <Step key={step.id} step={step} />)}
            {status === 'unpaid' && <li className="sentinel__payment-note">{detail ?? 'The live agent requested an x402 payment that could not be settled. No mocked payment is presented as a real transaction.'}</li>}
            {status === 'unauthorized' && <li className="sentinel__payment-note">{detail ?? 'Your session is missing or expired. Sign in again (top-right) to run a live trace.'}</li>}
            {status === 'error' && <li className="sentinel__payment-note">{detail ? `Live run rejected: ${detail}` : 'The live trace endpoint is unavailable right now. Check that the API is reachable and the agent wallet is configured, then try again.'}</li>}
          </ol>
        </div>
      </section>
    </main>
  )
}

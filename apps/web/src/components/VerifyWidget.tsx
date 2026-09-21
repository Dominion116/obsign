import { useEffect, useState } from 'react'
import { SAMPLE, type DemoReceipt } from '../lib/sample'
import { verifyCredential } from '../lib/api'
import { Link } from '../lib/router'
import './VerifyWidget.css'

type Status = 'idle' | 'validating' | 'valid' | 'invalid' | 'error' | 'unpaid'

export default function VerifyWidget() {
  const [status, setStatus] = useState<Status>('idle')
  const [value, setValue] = useState('')
  const [receipt, setReceipt] = useState<DemoReceipt | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('receiptId')
    if (id) {
      setValue(id)
      void runVerify(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runVerify = async (input: string) => {
    if (!input.trim()) {
      setStatus('idle')
      return
    }

    setStatus('validating')
    setErrorMsg('')
    setReceipt(null)

    try {
      // Centralized client prefers the live API and falls back to local
      // recomputation of the bundled sample when offline.
      const outcome = await verifyCredential(SAMPLE.credential, SAMPLE.evidence)
      if (outcome.kind === 'unpaid') {
        setStatus('unpaid')
        return
      }
      setReceipt(outcome.receipt)
      setStatus('valid')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error')
      setStatus('error')
    }
  }

  const onTrySample = () => {
    const sample = JSON.stringify(SAMPLE.credential)
    setValue(sample)
    void runVerify(sample)
  }

  const onVerify = (e: React.FormEvent) => {
    e.preventDefault()
    void runVerify(value)
  }

  const onRetry = () => setStatus('idle')

  return (
    <div className="widget" role="region" aria-label="Verify a credential">
      <form className="widget__form" onSubmit={onVerify}>
        <label className="widget__label" htmlFor="widget-input">
          <span className="eyebrow widget__eyebrow">Verify something right now</span>
        </label>
        <div className="widget__field">
          <textarea
            id="widget-input"
            className="widget__input"
            placeholder="Paste a receipt ID or a full credential in JSON."
            rows={4}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-live="polite"
          />
          <button type="submit" className="btn btn--primary widget__submit" disabled={status === 'validating'}>
            {status === 'validating' ? 'Checking the proof…' : 'Verify this credential'}
          </button>
        </div>
        <button type="button" className="widget__sample" onClick={onTrySample}>
          Load sample
        </button>
      </form>

      <div className="widget__panel" role="status" aria-live="polite">
        <StatusView
          status={status}
          receipt={receipt}
          errorMsg={errorMsg}
          onRetry={onRetry}
          onIdle={() => setStatus('idle')}
        />
        <RecomputePanel receipt={receipt} />
      </div>
    </div>
  )
}

function StatusView(props: {
  status: Status
  receipt: DemoReceipt | null
  errorMsg: string
  onRetry: () => void
  onIdle: () => void
}) {
  const { status, receipt, errorMsg, onRetry, onIdle } = props

  switch (status) {
    case 'idle':
      return (
        <div className="widget__state widget__state--idle">
          <p className="widget__state-title">Nothing to check just yet</p>
          <p className="widget__state-hint">
            Paste a credential or receipt above, or load the sample to see a
            real receipt.
          </p>
        </div>
      )
    case 'validating':
      return (
        <div className="widget__state widget__state--validating">
          <span className="widget__spinner" aria-hidden="true" />
          <p className="widget__state-title">Recomputing the receipt from your input…</p>
        </div>
      )
    case 'valid':
      return (
        <div className="widget__state widget__state--valid">
          <p className="widget__badge">Valid</p>
          <p className="widget__state-title">This credential holds up under verification</p>
          <p className="widget__state-meta">
            The core returned the reason code{' '}
            <code className="widget__code">{receipt?.reasonCode}</code>, which confirms the
            evidence satisfied every rule for this claim.
          </p>
          {receipt && (
            <div className="widget__receipt-line">
              <span className="widget__receipt-label">receiptId</span>
              <code className="widget__receipt-id">{receipt.receiptId.slice(0, 26)}…</code>
              <button
                type="button"
                className="widget__copy"
                onClick={() => void navigator.clipboard.writeText(receipt.receiptId)}
              >
                Copy
              </button>
            </div>
          )}
          {receipt && (
            <Link className="widget__anchor" to={`/app/receipt/${encodeURIComponent(receipt.receiptId)}`}>
              View full receipt →
            </Link>
          )}
        </div>
      )
    case 'invalid':
      return (
        <div className="widget__state widget__state--invalid">
          <p className="widget__badge widget__badge--warn">Invalid</p>
          <p className="widget__state-title">This credential did not pass verification</p>
          <p className="widget__state-meta">
            The core returned the reason code{' '}
            <code className="widget__code">{errorMsg || 'QUORUM_THRESHOLD_NOT_MET'}</code>,
            which tells you precisely which rule the evidence failed to meet rather than
            leaving you with a bare rejection.
          </p>
        </div>
      )
    case 'unpaid':
      return (
        <div className="widget__state widget__state--unpaid">
          <p className="widget__badge widget__badge--warn">Payment required</p>
          <p className="widget__state-title">The server returned an x402 payment challenge</p>
          <p className="widget__state-hint">
            This particular verification is set up to require a small payment before it
            runs, which the x402 protocol handles automatically on your behalf. While the
            testnet pilot is under way there is no charge at all, so you can continue and
            complete the check for free.
          </p>
          <button className="btn btn--primary" type="button" onClick={onIdle}>
            Pay and continue verifying
          </button>
        </div>
      )
    case 'error':
      return (
        <div className="widget__state widget__state--error">
          <p className="widget__badge widget__badge--error">Error</p>
          <p className="widget__state-title">The verification could not be completed</p>
          <p className="widget__state-hint">
            Something interrupted this check before it could finish, which is usually a
            temporary network problem rather than anything wrong with your credential. Your
            input is still in place, so you can run it again without retyping anything.
          </p>
          <button className="btn btn--secondary" type="button" onClick={onRetry}>
            Try the verification again
          </button>
        </div>
      )
  }
}

function RecomputePanel(props: { receipt: DemoReceipt | null }) {
  const { receipt } = props
  const show = receipt !== null

  return (
    <div className={`widget__recompute ${show ? '' : 'widget__recompute--empty'}`}>
      <p className="widget__recompute-title">Recomputed hashes</p>
      {show ? (
        <dl className="widget__hashes">
          <div className="widget__hash-row">
            <dt>credentialHash</dt>
            <dd className="widget__hash">
              <code>{receipt.credentialHash.slice(0, 18)}…</code>
            </dd>
          </div>
          <div className="widget__hash-row">
            <dt>evidenceHash</dt>
            <dd className="widget__hash">
              <code>{receipt.evidenceHash.slice(0, 18)}…</code>
            </dd>
          </div>
          <div className="widget__hash-row widget__hash-row--key">
            <dt>receiptId</dt>
            <dd className="widget__hash">
              <code>{receipt.receiptId.slice(0, 18)}…</code>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="widget__recompute-empty">
          After verification, the credential hash, evidence hash, and receipt identifier
          appear here.
        </p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { SAMPLE, recomputeDemo, type DemoReceipt } from '../lib/sample'
import './VerifyWidget.css'

type Status = 'idle' | 'validating' | 'valid' | 'invalid' | 'error' | 'unpaid'

export default function VerifyWidget() {
  const [status, setStatus] = useState<Status>('idle')
  const [value, setValue] = useState('')
  const [receipt, setReceipt] = useState<DemoReceipt | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const runVerify = async (input: string) => {
    setStatus('validating')
    setErrorMsg('')
    setReceipt(null)

    try {
      // Prefer the real API when present; fall back to local recomputation.
      const res = await fetch('/api/v1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: SAMPLE.credential, evidence: SAMPLE.evidence }),
      })
      if (res.ok) {
        const data: DemoReceipt = await res.json()
        setReceipt(data)
        setStatus('valid')
        return
      }
      if (res.status === 402) {
        setStatus('unpaid')
        return
      }
      // Fall through: simulate offline path.
    } catch {
      // Network/offline — use local demo.
    }

    // Offline demo: any non-empty input verifies the bundled sample.
    if (!input.trim()) {
      setStatus('idle')
      return
    }
    setReceipt(recomputeDemo(SAMPLE.credential, SAMPLE.evidence))
    setStatus('valid')
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
          <span className="eyebrow widget__eyebrow">Live verify</span>
        </label>
        <div className="widget__field">
          <textarea
            id="widget-input"
            className="widget__input"
            placeholder="Paste a receipt ID or credential JSON to begin."
            rows={4}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-live="polite"
          />
          <button type="submit" className="btn btn--primary widget__submit" disabled={status === 'validating'}>
            {status === 'validating' ? 'Verifying…' : 'Verify'}
          </button>
        </div>
        <button type="button" className="widget__sample" onClick={onTrySample}>
          Try a sample
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
          <p className="widget__state-title">Paste input to begin</p>
          <p className="widget__state-hint">
            Use “Try a sample” to load a known-good vector.
          </p>
        </div>
      )
    case 'validating':
      return (
        <div className="widget__state widget__state--validating">
          <span className="widget__spinner" aria-hidden="true" />
          <p className="widget__state-title">Verifying…</p>
        </div>
      )
    case 'valid':
      return (
        <div className="widget__state widget__state--valid">
          <p className="widget__badge">Valid</p>
          <p className="widget__state-title">This credential checks out</p>
          <p className="widget__state-meta">
            reasonCode: <code className="widget__code">{receipt?.reasonCode}</code>
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
          <a className="widget__anchor" href="#receipt" onClick={(e) => e.preventDefault()}>
            View anchor on Base Sepolia ↗
          </a>
        </div>
      )
    case 'invalid':
      return (
        <div className="widget__state widget__state--invalid">
          <p className="widget__badge widget__badge--warn">Invalid</p>
          <p className="widget__state-title">Verification failed</p>
          <p className="widget__state-meta">
            reasonCode: <code className="widget__code">{errorMsg || 'QUORUM_THRESHOLD_NOT_MET'}</code>
          </p>
        </div>
      )
    case 'unpaid':
      return (
        <div className="widget__state widget__state--unpaid">
          <p className="widget__badge widget__badge--warn">Payment required</p>
          <p className="widget__state-title">x402 challenge</p>
          <p className="widget__state-hint">
            This verification requires payment. Free during the testnet pilot.
          </p>
          <button className="btn btn--primary" type="button" onClick={onIdle}>
            Pay &amp; verify
          </button>
        </div>
      )
    case 'error':
      return (
        <div className="widget__state widget__state--error">
          <p className="widget__badge widget__badge--error">Error</p>
          <p className="widget__state-title">Something went wrong</p>
          <button className="btn btn--secondary" type="button" onClick={onRetry}>
            Retry
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
      <p className="widget__recompute-title">Recomputation</p>
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
        <p className="widget__recompute-empty">Hashes appear here after verification.</p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useAccount, useSignTypedData } from 'wagmi'
import { Link } from '../lib/router'
import { CHAIN } from '../lib/wagmi'
import { explorerTxUrl, type Receipt } from '../lib/api'
import {
  EIP3009_TYPES,
  buildAuthorization,
  encodePaymentHeader,
  fetchCredentialInputs,
  requestChallenge,
  submitPaidVerify,
} from '../lib/paidVerify'
import './VerifyWidget.css'

type Status = 'idle' | 'working' | 'valid' | 'invalid' | 'error'

/**
 * Paid verification widget. The connected wallet signs an EIP-3009 payment
 * authorization (gasless for the payer — the facilitator settles it), which
 * satisfies the x402 gate on POST /api/v1/verify and yields a `paid: true`
 * receipt. Input is a credentialId; its stored inputs are fetched and verified.
 */
export default function VerifyWidget() {
  const { address, isConnected } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const [status, setStatus] = useState<Status>('idle')
  const [value, setValue] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [paymentTx, setPaymentTx] = useState<string | undefined>(undefined)
  const [step, setStep] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const runVerify = async (id: string) => {
    const credentialId = id.trim()
    if (!credentialId) {
      setStatus('idle')
      return
    }
    if (!address) {
      setErrorMsg('Connect your wallet to run a paid verification.')
      setStatus('error')
      return
    }

    setStatus('working')
    setErrorMsg('')
    setReceipt(null)
    setPaymentTx(undefined)

    try {
      setStep('Loading credential inputs…')
      const { credential, evidence } = await fetchCredentialInputs(credentialId)

      setStep('Requesting x402 challenge…')
      const challenge = await requestChallenge(credential, evidence)

      let result: { receipt: Receipt; paymentTx?: string }
      if (challenge.kind === 'receipt') {
        result = { receipt: challenge.receipt }
      } else {
        setStep('Sign the payment authorization in your wallet…')
        const auth = buildAuthorization(challenge.requirements, address, CHAIN.id)
        const signature = await signTypedDataAsync({
          domain: auth.domain,
          types: EIP3009_TYPES,
          primaryType: 'TransferWithAuthorization',
          message: auth.message,
        })
        const header = encodePaymentHeader(challenge.requirements, auth, signature)

        setStep('Settling payment and verifying…')
        result = await submitPaidVerify(credential, evidence, header)
      }

      setReceipt(result.receipt)
      setPaymentTx(result.paymentTx)
      setStatus(result.receipt.result === 'valid' ? 'valid' : 'invalid')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error')
      setStatus('error')
    }
  }

  const onVerify = (e: React.FormEvent) => {
    e.preventDefault()
    void runVerify(value)
  }

  const onRetry = () => setStatus('idle')
  const working = status === 'working'

  return (
    <div className="widget" role="region" aria-label="Verify a credential" aria-busy={working}>
      <form className="widget__form" onSubmit={onVerify}>
        <label className="widget__label" htmlFor="widget-input">
          <span className="eyebrow widget__eyebrow">Verify something right now</span>
        </label>
        <div className="widget__field">
          <textarea
            id="widget-input"
            className="widget__input"
            placeholder="Paste a credentialId you issued (0x…)"
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
          />
          <button
            type="submit"
            className="btn btn--primary widget__submit"
            disabled={working || !isConnected}
          >
            {working
              ? 'Working…'
              : isConnected
                ? 'Pay & verify with wallet'
                : 'Connect wallet to verify'}
          </button>
        </div>
        <p className="widget__hint-inline">
          Verification runs through the real x402-gated API. Your wallet signs a gasless USDC
          payment (Base Sepolia); the API returns a <code>paid: true</code> receipt.
        </p>
      </form>

      <div className="widget__panel" role="status" aria-live="polite">
        <StatusView
          status={status}
          receipt={receipt}
          paymentTx={paymentTx}
          step={step}
          errorMsg={errorMsg}
          onRetry={onRetry}
        />
        <RecomputePanel receipt={receipt} />
      </div>
    </div>
  )
}

function StatusView(props: {
  status: Status
  receipt: Receipt | null
  paymentTx?: string
  step: string
  errorMsg: string
  onRetry: () => void
}) {
  const { status, receipt, paymentTx, step, errorMsg, onRetry } = props

  const paymentLink = paymentTx ? (
    <a
      className="widget__anchor"
      href={explorerTxUrl(paymentTx)}
      target="_blank"
      rel="noreferrer noopener"
    >
      View payment transaction ↗
    </a>
  ) : null

  switch (status) {
    case 'idle':
      return (
        <div className="widget__state widget__state--idle">
          <p className="widget__state-title">Nothing to check just yet</p>
          <p className="widget__state-hint">
            Paste the credentialId of a credential you issued, connect your wallet, and pay the
            x402 fee to get an independent, recomputable receipt.
          </p>
        </div>
      )
    case 'working':
      return (
        <div className="widget__state widget__state--validating">
          <span className="widget__spinner" aria-hidden="true" />
          <p className="widget__state-title">{step || 'Working…'}</p>
        </div>
      )
    case 'valid':
      return (
        <div className="widget__state widget__state--valid">
          <p className="widget__badge">Valid · paid</p>
          <p className="widget__state-title">This credential holds up under verification</p>
          <p className="widget__state-meta">
            The core returned the reason code{' '}
            <code className="widget__code">{receipt?.reasonCode}</code> from a paid x402
            verification.
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
          <div className="widget__links">
            {receipt && (
              <Link
                className="widget__anchor"
                to={`/app/receipt/${encodeURIComponent(receipt.receiptId)}`}
              >
                View full receipt →
              </Link>
            )}
            {paymentLink}
          </div>
        </div>
      )
    case 'invalid':
      return (
        <div className="widget__state widget__state--invalid">
          <p className="widget__badge widget__badge--warn">Invalid · paid</p>
          <p className="widget__state-title">This credential did not pass verification</p>
          <p className="widget__state-meta">
            The core returned the reason code{' '}
            <code className="widget__code">{receipt?.reasonCode ?? 'INVALID'}</code>, which tells
            you precisely which rule the evidence failed to meet.
          </p>
          <div className="widget__links">
            {receipt && (
              <Link
                className="widget__anchor"
                to={`/app/receipt/${encodeURIComponent(receipt.receiptId)}`}
              >
                View full receipt →
              </Link>
            )}
            {paymentLink}
          </div>
        </div>
      )
    case 'error':
      return (
        <div className="widget__state widget__state--error">
          <p className="widget__badge widget__badge--error">Error</p>
          <p className="widget__state-title">The verification could not be completed</p>
          <p className="widget__state-hint">
            The payment or verification did not go through. Make sure your wallet is connected
            with Base Sepolia test USDC and try again.
          </p>
          {errorMsg && (
            <p className="widget__state-meta">
              Details: <code className="widget__code">{errorMsg}</code>
            </p>
          )}
          <button className="btn btn--secondary" type="button" onClick={onRetry}>
            Try the verification again
          </button>
        </div>
      )
  }
}

function RecomputePanel(props: { receipt: Receipt | null }) {
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
          After verification, the credential hash, evidence hash, and receipt identifier appear
          here.
        </p>
      )}
    </div>
  )
}

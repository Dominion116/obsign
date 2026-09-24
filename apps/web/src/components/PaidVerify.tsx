import { useState } from 'react'
import { useAccount, useChainId, useSignTypedData } from 'wagmi'
import { Link } from '../lib/router'
import { explorerTxUrl } from '../lib/api'
import {
  EIP3009_TYPES,
  buildAuthorization,
  encodePaymentHeader,
  fetchCredentialInputs,
  requestChallenge,
  submitPaidVerify,
  type PaidVerifyResult,
} from '../lib/paidVerify'
import './PaidVerify.css'

type State =
  | { kind: 'idle' }
  | { kind: 'working'; step: string }
  | { kind: 'done'; result: PaidVerifyResult; alreadyOpen: boolean }
  | { kind: 'error'; message: string }

export default function PaidVerify() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { signTypedDataAsync } = useSignTypedData()
  const [credentialId, setCredentialId] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!address) {
      setState({ kind: 'error', message: 'Connect your wallet first.' })
      return
    }
    const id = credentialId.trim()
    if (!id) {
      setState({ kind: 'error', message: 'Enter the credentialId you want to verify.' })
      return
    }
    try {
      setState({ kind: 'working', step: 'Loading credential inputs…' })
      const { credential, evidence } = await fetchCredentialInputs(id)

      setState({ kind: 'working', step: 'Requesting x402 challenge…' })
      const challenge = await requestChallenge(credential, evidence)
      if (challenge.kind === 'receipt') {
        // Endpoint was open (no payment gate configured) — nothing to pay.
        setState({ kind: 'done', result: { receipt: challenge.receipt }, alreadyOpen: true })
        return
      }

      setState({ kind: 'working', step: 'Sign the payment authorization in your wallet…' })
      const auth = buildAuthorization(challenge.requirements, address, chainId)
      const signature = await signTypedDataAsync({
        domain: auth.domain,
        types: EIP3009_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: auth.message,
      })
      const header = encodePaymentHeader(challenge.requirements, auth, signature)

      setState({ kind: 'working', step: 'Settling payment and verifying…' })
      const result = await submitPaidVerify(credential, evidence, header)
      setState({ kind: 'done', result, alreadyOpen: false })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Unexpected error' })
    }
  }

  const working = state.kind === 'working'

  return (
    <section className="paidverify">
      <h2 className="paidverify__title">Paid verification (x402)</h2>
      <p className="paidverify__lead">
        Verify one of your issued credentials through the real x402-gated API. Your wallet signs a
        gasless USDC payment authorization (EIP-3009) on Base Sepolia — the facilitator settles it —
        and the API returns a <code>paid: true</code> receipt.
      </p>

      <form className="paidverify__form" onSubmit={(e) => void run(e)}>
        <label className="paidverify__field">
          <span className="paidverify__label">credentialId</span>
          <input
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            placeholder="0x… (a credential you issued)"
            spellCheck={false}
          />
        </label>
        <button className="btn btn--primary" type="submit" disabled={working || !isConnected}>
          {working ? 'Working…' : isConnected ? 'Pay & verify with wallet' : 'Connect wallet first'}
        </button>
      </form>

      {working && <p className="paidverify__status" aria-live="polite">{state.step}</p>}
      {state.kind === 'error' && (
        <p className="paidverify__error" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === 'done' && (
        <div className="paidverify__result" role="status">
          <p className="paidverify__result-title">
            {state.alreadyOpen
              ? 'Verified (this endpoint required no payment)'
              : 'Paid verification complete'}
          </p>
          <dl className="paidverify__rows">
            <div>
              <dt>result</dt>
              <dd>{state.result.receipt.result}</dd>
            </div>
            <div>
              <dt>reasonCode</dt>
              <dd>
                <code>{state.result.receipt.reasonCode}</code>
              </dd>
            </div>
            <div>
              <dt>paid</dt>
              <dd>
                <code>{String(state.result.receipt.paid ?? !state.alreadyOpen)}</code>
              </dd>
            </div>
          </dl>
          <div className="paidverify__actions">
            <Link
              className="btn btn--primary"
              to={`/app/receipt/${encodeURIComponent(state.result.receipt.receiptId)}`}
            >
              View receipt
            </Link>
            {state.result.paymentTx && (
              <a
                href={explorerTxUrl(state.result.paymentTx)}
                target="_blank"
                rel="noreferrer noopener"
              >
                View payment transaction ↗
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

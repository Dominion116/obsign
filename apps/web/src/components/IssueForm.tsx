// Interactive issue flow (P3-3). Requires a connected, signed-in wallet. Builds
// a credential, computes its hashes with @obsign/core, has the wallet sign the
// credentialHash and submit the anchor tx, then POSTs to the API.

import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { buildCredential, issueCredential, type SignMessage } from '../lib/issuance'
import { getSessionToken } from '../lib/backend'
import { explorerTxUrl } from '../lib/api'

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; step: string }
  | { kind: 'done'; receiptId: string; credentialId: string; anchorTx: string }
  | { kind: 'error'; message: string }

export default function IssueForm() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [subject, setSubject] = useState('')
  const [claim, setClaim] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const ready = isConnected && !!address && getSessionToken() !== null
  const issuerLabel = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : 'Wallet not connected'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address) return
    setStatus({ kind: 'working', step: 'Building credential' })
    try {
      const credential = buildCredential({ issuer: address, subject, claim })
      const res = await issueCredential({
        credential,
        evidence: [],
        signMessage: signMessageAsync as unknown as SignMessage,
      })
      setStatus({
        kind: 'done',
        receiptId: res.receiptId,
        credentialId: res.credentialId,
        anchorTx: res.anchorTx,
      })
      setSubject('')
      setClaim('')
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <form className="issue__form" onSubmit={(e) => void onSubmit(e)}>
      <div className="issue__form-top">
        <div>
          <p className="issue__form-kicker">Credential draft</p>
          <h2 className="issue__form-title">Issue a credential</h2>
          <p className="issue__form-subtitle">
            Define a claim, sign it with your issuer wallet, and anchor its proof on Base.
          </p>
        </div>
        <span className={`issue__connection ${ready ? 'issue__connection--ready' : ''}`}>
          <span className="issue__connection-dot" aria-hidden="true" />
          {ready ? 'Ready to issue' : 'Setup required'}
        </span>
      </div>

      <div className="issue__issuer">
        <span className="issue__issuer-label">Issuing wallet</span>
        <span className="issue__issuer-value">{issuerLabel}</span>
        <span className="issue__issuer-state">
          {isConnected ? (ready ? 'Authenticated issuer' : 'Sign in to continue') : 'Connect to begin'}
        </span>
      </div>

      <div className="issue__fields">
        <label className="issue__field">
          <span className="issue__field-label"><b>01</b> Subject</span>
          <span className="issue__field-help">Who should receive this credential?</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="0x… or a subject identifier"
            required
          />
        </label>

        <label className="issue__field">
          <span className="issue__field-label"><b>02</b> Claim</span>
          <span className="issue__field-help">State the fact this credential proves.</span>
          <input
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="e.g. Attendance — Obsign 2026"
            required
          />
        </label>
      </div>

      {!isConnected && <p className="issue__hint">Connect your wallet to begin issuing.</p>}
      {isConnected && !ready && <p className="issue__hint">Sign in with your wallet to authorize this issuer.</p>}

      <div className="issue__form-footer">
        <p className="issue__form-note">
          You’ll be asked to sign the credential and its anchor transaction. Nothing is issued
          until both are confirmed.
        </p>
        <button
          type="submit"
          className="btn btn--primary issue__submit"
          disabled={!ready || status.kind === 'working'}
        >
          {status.kind === 'working' ? status.step + '…' : 'Sign & anchor'}
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      {status.kind === 'error' && (
        <p className="issue__error" role="alert">{status.message}</p>
      )}
      {status.kind === 'done' && (
        <div className="issue__result" role="status">
          <span className="issue__result-mark" aria-hidden="true">✓</span>
          <div>
            <p className="issue__result-title">Credential anchored</p>
            <p className="issue__result-detail">
              Receipt <code>{status.receiptId.slice(0, 18)}…</code>
            </p>
          </div>
          <a href={explorerTxUrl(status.anchorTx)} target="_blank" rel="noreferrer">
            View anchor transaction
          </a>
        </div>
      )}
    </form>
  )
}

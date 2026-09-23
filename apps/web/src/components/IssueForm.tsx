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
      <h2 className="issue__form-title">Issue a credential</h2>
      {!isConnected && <p className="issue__hint">Connect your wallet to begin.</p>}
      {isConnected && !ready && <p className="issue__hint">Sign in with your wallet to issue.</p>}

      <label className="issue__field">
        <span>Subject (address or identifier)</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="0x… or subject id"
          required
        />
      </label>

      <label className="issue__field">
        <span>Claim</span>
        <input
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="e.g. Attendance — Obsign 2026"
          required
        />
      </label>

      <button
        type="submit"
        className="btn btn--primary"
        disabled={!ready || status.kind === 'working'}
      >
        {status.kind === 'working' ? status.step + '…' : 'Sign & anchor'}
      </button>

      {status.kind === 'error' && <p className="issue__error">{status.message}</p>}
      {status.kind === 'done' && (
        <div className="issue__result">
          <p>
            Anchored. Receipt <code>{status.receiptId.slice(0, 18)}…</code>
          </p>
          <a href={explorerTxUrl(status.anchorTx)} target="_blank" rel="noreferrer">
            View anchor transaction
          </a>
        </div>
      )}
    </form>
  )
}

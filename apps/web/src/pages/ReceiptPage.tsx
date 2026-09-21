import { useMemo } from 'react'
import './ReceiptPage.css'

interface Receipt {
  receiptId: string
  credentialHash: string
  evidenceHash: string
  result: string
  reasonCode: string
  issuer: string
  subject: string
  verifiedAt: string
  verifier: string
  anchor: { chainId: number; txHash: string; blockNumber: number }
  paid: boolean
}

export default function ReceiptPage({ receiptId }: { receiptId: string }) {
  const receipt = useMemo<Receipt>(() => {
    const id = receiptId || '0x0000000000000000000000000000000000000000000000000000'
    return {
      receiptId: id,
      credentialHash: '0x' + 'a1'.repeat(32),
      evidenceHash: '0x' + 'b2'.repeat(32),
      result: 'valid',
      reasonCode: 'OK',
      issuer: '0x1111111111111111111111111111111111111111',
      subject: '0x2222222222222222222222222222222222222222',
      verifiedAt: '2026-09-21T00:00:00.000Z',
      verifier: 'obsign-core/1.0.0',
      anchor: { chainId: 84532, txHash: '0x' + 'cd'.repeat(20), blockNumber: 12345678 },
      paid: false,
    }
  }, [receiptId])

  const short = (h: string) => `${h.slice(0, 12)}…${h.slice(-8)}`
  const permalink = `${window.location.origin}/receipt/${encodeURIComponent(receipt.receiptId)}`

  const copy = (text: string) => () => void navigator.clipboard.writeText(text)

  return (
    <main className="receipt">
      <section className="receipt__page">
        <div className="container">
          <a className="receipt__back" href="/">
            ← Back to home
          </a>

          <div className={`receipt__card receipt__card--${receipt.result}`}>
            <div className="receipt__head">
              <span className="receipt__badge">{receipt.reasonCode}</span>
              <span className="receipt__result">Result: {receipt.result}</span>
            </div>

            <dl className="receipt__rows">
              <Row label="receiptId" value={receipt.receiptId} onCopy={copy(receipt.receiptId)} mono />
              <Row
                label="credentialHash"
                value={short(receipt.credentialHash)}
                onCopy={copy(receipt.credentialHash)}
                mono
              />
              <Row
                label="evidenceHash"
                value={short(receipt.evidenceHash)}
                onCopy={copy(receipt.evidenceHash)}
                mono
              />
              <Row label="issuer" value={receipt.issuer} mono />
              <Row label="subject" value={receipt.subject} mono />
              <Row label="verifiedAt" value={receipt.verifiedAt} />
              <Row label="verifier" value={receipt.verifier} />
              <Row
                label="anchor"
                value={`Base Sepolia (${receipt.anchor.chainId}) · block ${receipt.anchor.blockNumber}`}
              />
              <Row label="anchor tx" value={short(receipt.anchor.txHash)} mono />
              <Row label="paid" value={String(receipt.paid)} />
            </dl>
          </div>

          <div className="receipt__share">
            <p className="receipt__share-title">Share this receipt</p>
            <div className="receipt__share-row">
              <input className="receipt__share-input" readOnly value={permalink} />
              <button className="btn btn--primary" type="button" onClick={copy(permalink)}>
                Copy link
              </button>
            </div>
          </div>

          <p className="receipt__note">
            Demo receipt — recomputed offline from the published spec. Independent parties
            reproduce the same receiptId byte-for-byte.
          </p>
        </div>
      </section>
    </main>
  )
}

function Row(props: {
  label: string
  value: string
  mono?: boolean
  onCopy?: () => void
}) {
  const { label, value, mono, onCopy } = props
  return (
    <div className="receipt__row">
      <dt className="receipt__row-label">{label}</dt>
      <dd className="receipt__row-value">
        <span className={mono ? 'receipt__mono' : undefined}>{value}</span>
        {onCopy && (
          <button type="button" className="receipt__copy" onClick={onCopy}>
            Copy
          </button>
        )}
      </dd>
    </div>
  )
}

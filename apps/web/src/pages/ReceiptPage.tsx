import { useAsyncData } from '../lib/useAsyncData'
import { fetchReceipt, explorerTxUrl, type Receipt } from '../lib/api'
import Skeleton from '../components/Skeleton'
import './ReceiptPage.css'

const ROW_COUNT = 10

export default function ReceiptPage({ receiptId }: { receiptId: string }) {
  const { data, loading } = useAsyncData<Receipt>(() => fetchReceipt(receiptId), [receiptId])

  const short = (h: string) => `${h.slice(0, 12)}…${h.slice(-8)}`
  const permalink = `${window.location.origin}/app/receipt/${encodeURIComponent(receiptId)}`
  const copy = (text: string) => () => void navigator.clipboard.writeText(text)

  return (
    <main className="receipt">
      <section className="receipt__page section">
        <div className="container">
          <div className="receipt__headings">
            <p className="eyebrow">Verification receipt</p>
            <h1 className="receipt__title">Proof you can <span className="script-accent">recompute.</span></h1>
          </div>
          {loading || !data ? (
            <div className="receipt__card receipt__card--valid" aria-busy="true" role="status" aria-label="Loading receipt">
              <div className="receipt__head">
                <Skeleton variant="chip" />
                <Skeleton width="8rem" height="1rem" />
              </div>
              <dl className="receipt__rows">
                {Array.from({ length: ROW_COUNT }).map((_, i) => (
                  <div key={i} className="receipt__row">
                    <dt className="receipt__row-label">
                      <Skeleton width="6rem" height="0.8rem" />
                    </dt>
                    <dd className="receipt__row-value">
                      <Skeleton width={`${50 + ((i * 7) % 40)}%`} height="0.9rem" />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className={`receipt__card receipt__card--${data.result}`}>
              <div className="receipt__head">
                <span className="receipt__badge">{data.reasonCode}</span>
                <span className="receipt__result">Result: {data.result}</span>
              </div>

              <dl className="receipt__rows">
                <Row label="receiptId" value={data.receiptId} onCopy={copy(data.receiptId)} mono />
                <Row
                  label="credentialHash"
                  value={short(data.credentialHash)}
                  onCopy={copy(data.credentialHash)}
                  mono
                />
                <Row
                  label="evidenceHash"
                  value={short(data.evidenceHash)}
                  onCopy={copy(data.evidenceHash)}
                  mono
                />
                <Row label="issuer" value={data.issuer} mono />
                <Row label="subject" value={data.subject} mono />
                <Row label="verifiedAt" value={data.verifiedAt} />
                <Row label="verifier" value={data.verifier} />
                <Row
                  label="anchor"
                  value={`Base Sepolia (${data.anchor.chainId}) · block ${data.anchor.blockNumber}`}
                />
                <Row
                  label="anchor tx"
                  value={short(data.anchor.txHash)}
                  href={explorerTxUrl(data.anchor.txHash)}
                  mono
                />
                <Row label="paid" value={String(data.paid)} />
              </dl>
            </div>
          )}

          <div className="receipt__share">
            <p className="receipt__share-title">Share this receipt with others</p>
            <div className="receipt__share-row">
              <input className="receipt__share-input" aria-label="Receipt share link" readOnly value={permalink} />
              <button className="btn btn--primary" type="button" onClick={copy(permalink)}>
                Copy link
              </button>
            </div>
          </div>

          <p className="receipt__note">
            This is a demonstration receipt that was recomputed offline directly from the
            published specification. Any independent party who starts from the same inputs
            will arrive at this exact receipt identifier, byte for byte, which is what lets
            the result stand on its own without depending on our systems.
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
  href?: string
}) {
  const { label, value, mono, onCopy, href } = props
  return (
    <div className="receipt__row">
      <dt className="receipt__row-label">{label}</dt>
      <dd className="receipt__row-value">
        {href ? (
          <a
            className={`receipt__external ${mono ? 'receipt__mono' : ''}`}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {value} ↗
          </a>
        ) : (
          <span className={mono ? 'receipt__mono' : undefined}>{value}</span>
        )}
        {onCopy && (
          <button type="button" className="receipt__copy" onClick={onCopy}>
            Copy
          </button>
        )}
      </dd>
    </div>
  )
}

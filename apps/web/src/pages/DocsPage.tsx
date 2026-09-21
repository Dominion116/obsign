import './DocsPage.css'

const RECEIPT_SECTIONS = [
  {
    title: 'Recomputable IDs',
    body: [
      'The heart of the design: given the same credential and evidence, any party reproduces the exact same receiptId.',
    ],
    lines: [
      'credentialHash = keccak256(utf8(JCS(credential)))',
      'evidenceHash   = keccak256(utf8(JCS(evidence)))',
      'receiptId      = keccak256(concat(credentialHash, evidenceHash))',
    ],
  },
  {
    title: 'Canonicalization',
    body: [
      'Inputs are canonicalized with RFC 8785 (JCS), so key order never matters and two machines hash the same bytes.',
    ],
  },
  {
    title: 'Verdict metadata',
    body: [
      'Verdict details are appended outside the hashed inputs. Payment, latency, or who asked never touch the ID.',
    ],
  },
]

const MODULES = [
  'Quorum — a threshold of independent co-signers approved the same message',
  'Onchain event — a pinned transaction or log exists on Base, never against latest',
  'Artifact hash — a fetched artifact matches a recorded SHA-256 checksum',
]

const REASON_CODES = ['OK', 'QUORUM_THRESHOLD_NOT_MET', 'EVENT_NOT_FOUND', 'REVOKED']

const API_ENDPOINTS = [
  { method: 'POST', path: '/api/v1/verify', note: 'x402-gated', body: '{ credential, evidence }' },
  { method: 'GET', path: '/api/v1/receipts/:receiptId', note: '', body: '—' },
  { method: 'GET', path: '/api/v1/credentials/:id', note: '', body: '—' },
  { method: 'POST', path: '/api/v1/credentials', note: 'issuer-auth', body: 'credential draft + evidence' },
  { method: 'POST', path: '/api/v1/credentials/:id/revoke', note: 'issuer-auth', body: '—' },
  { method: 'GET', path: '/api/v1/issuers/:address', note: '', body: '—' },
  { method: 'GET', path: '/api/v1/health', note: '', body: '—' },
  { method: 'POST', path: '/api/mcp', note: 'streamable HTTP', body: '—' },
]

const MCP_TOOLS = [
  { name: 'obsign_verify', desc: 'Verify credential + evidence → receipt', gate: 'x402-gated' },
  { name: 'obsign_issue', desc: 'Issue credential draft + evidence', gate: 'issuer-auth' },
  { name: 'obsign_get_receipt', desc: 'Fetch a receipt by receiptId', gate: '' },
  { name: 'obsign_get_issuer', desc: 'Resolve issuer metadata by address', gate: '' },
]

const SDK_SNIPPET = `import { verify } from '@obsign/sdk'

const receipt = await verify({
  credential,
  evidence,
})

// Offline verification needs no network:
const offline = verify.offline({ credential, evidence })`

const INVARIANTS = [
  { code: 'INV-1', text: 'The core is pure. No network, database, ambient clock, or randomness.' },
  { code: 'INV-2', text: 'Receipts are recomputable — a third party reproduces the same receiptId.' },
  { code: 'INV-3', text: 'Payment never affects validity. API, CLI, and third party all agree.' },
  { code: 'INV-4', text: 'The database is a cache. MongoDB is never required to recompute a receipt.' },
  { code: 'INV-5', text: 'The LLM is outside the validity path. Model output can explain, never decide.' },
  { code: 'INV-6', text: 'Chain reads are pinned. Verify against a specific block, never latest.' },
  { code: 'INV-7', text: 'No plaintext issuer keys in MongoDB. Keys live behind the KeyProvider interface.' },
]

export default function DocsPage() {
  return (
    <main className="docs">
      <section className="docs__body section">
        <div className="container">
          <div className="docs__head">
            <p className="eyebrow">Documentation</p>
            <h1 className="docs__title">
              The Obsign <span className="script-accent">spec.</span>
            </h1>
            <p className="docs__lead">
              The normative rules behind every receipt: how IDs are derived, how evidence
              is verified, and the invariants that keep the system trustworthy.
            </p>
          </div>
        </div>
        <div className="container docs__grid">
          <aside className="docs__nav" aria-label="On this page">
            <h2 className="docs__nav-title">On this page</h2>
            <ul>
              <li><a href="#receipt">The receipt</a></li>
              <li><a href="#modules">Evidence modules</a></li>
              <li><a href="#reason-codes">Reason codes</a></li>
              <li><a href="#api">API</a></li>
              <li><a href="#mcp">MCP tools</a></li>
              <li><a href="#sdk">SDK</a></li>
              <li><a href="#invariants">Invariants</a></li>
            </ul>
          </aside>

          <div className="docs__content">
            <section id="receipt" className="docs__section">
              <h2 className="docs__section-title">The receipt</h2>
              <p className="docs__section-lead">
                A receipt is the canonical result object every verifier path returns.
              </p>

              <div className="docs__code-block">
                <pre>{`{
  "v": 1,
  "receiptId": "0x...",
  "credentialHash": "0x...",
  "evidenceHash": "0x...",
  "result": "valid",
  "reasonCode": "OK",
  "issuer": "0x...",
  "subject": "0x...",
  "verifiedAt": "2026-09-13T00:00:00.000Z",
  "verifier": "obsign-core/1.0.0",
  "anchor": { "chainId": 84532, "txHash": "0x...", "blockNumber": 12345678 },
  "paid": false
}`}</pre>
              </div>

              {RECEIPT_SECTIONS.map((s) => (
                <div key={s.title} className="docs__sub">
                  <h3 className="docs__sub-title">{s.title}</h3>
                  {s.body.map((b) => (
                    <p key={b} className="docs__sub-body">
                      {b}
                    </p>
                  ))}
                  {s.lines && (
                    <pre className="docs__inline-code">{s.lines.join('\n')}</pre>
                  )}
                </div>
              ))}
            </section>

            <section id="modules" className="docs__section">
              <h2 className="docs__section-title">Evidence modules</h2>
              <p className="docs__section-lead">
                Every credential must back its claim with exactly one machine-checkable module.
              </p>
              <ul className="docs__list">
                {MODULES.map((m) => (
                  <li key={m} className="docs__list-item">
                    {m}
                  </li>
                ))}
              </ul>
            </section>

            <section id="reason-codes" className="docs__section">
              <h2 className="docs__section-title">Reason codes</h2>
              <p className="docs__section-lead">
                A bare boolean is never enough. Every verification returns a fixed,
                machine-readable reason code.
              </p>
              <div className="docs__codes">
                {REASON_CODES.map((c) => (
                  <code key={c} className="docs__code-tag">
                    {c}
                  </code>
                ))}
              </div>
            </section>

            <section id="api" className="docs__section">
              <h2 className="docs__section-title">API</h2>
              <p className="docs__section-lead">
                REST surface, versioned and machine-readable. Unpaid verification returns
                an x402 challenge.
              </p>
              <div className="docs__table-wrap">
                <table className="docs__table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Path</th>
                      <th>Auth</th>
                      <th>Body</th>
                    </tr>
                  </thead>
                  <tbody>
                    {API_ENDPOINTS.map((e) => (
                      <tr key={e.method + e.path}>
                        <td><code className="docs__method">{e.method}</code></td>
                        <td><code className="docs__path">{e.path}</code></td>
                        <td className="docs__muted">{e.note || '—'}</td>
                        <td><code className="docs__path">{e.body}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="mcp" className="docs__section">
              <h2 className="docs__section-title">MCP tools</h2>
              <p className="docs__section-lead">
                Exposed over streamable HTTP at <code className="docs__inline-code-tag">/api/mcp</code>.
              </p>
              <div className="docs__table-wrap">
                <table className="docs__table">
                  <thead>
                    <tr>
                      <th>Tool</th>
                      <th>Description</th>
                      <th>Auth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MCP_TOOLS.map((t) => (
                      <tr key={t.name}>
                        <td><code className="docs__path">{t.name}</code></td>
                        <td>{t.desc}</td>
                        <td className="docs__muted">{t.gate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="sdk" className="docs__section">
              <h2 className="docs__section-title">SDK</h2>
              <p className="docs__section-lead">
                <code className="docs__inline-code-tag">@obsign/sdk</code> exposes typed API
                helpers and fully offline verification.
              </p>
              <pre className="docs__code-block">{SDK_SNIPPET}</pre>
            </section>

            <section id="invariants" className="docs__section">
              <h2 className="docs__section-title">Invariants</h2>
              <p className="docs__section-lead">
                These rules override any other instruction. If a change would break one,
                stop and surface the conflict first.
              </p>
              <ul className="docs__invariants">
                {INVARIANTS.map((i) => (
                  <li key={i.code} className="docs__invariant">
                    <code className="docs__invariant-code">{i.code}</code>
                    <span className="docs__invariant-text">{i.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}

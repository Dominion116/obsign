import { Link } from '../lib/router'
import './DocsPage.css'

const MODULES = [
  { title: 'Quorum of signers', body: 'Use this when a claim needs agreement from more than one independent party. Obsign verifies the threshold, the approved message, and every signer before accepting the credential.' },
  { title: 'Onchain event', body: 'Use this when a claim is tied to activity on Base. Obsign checks the requested transaction or log against a pinned block, so the result can be reproduced later.' },
  { title: 'Artifact hash', body: 'Use this when the proof is a file, record, or published artifact. Obsign fetches the artifact and confirms that its checksum matches the one named by the credential.' },
]

const API_ENDPOINTS = [
  { method: 'POST', path: '/api/v1/verify', access: 'x402-gated', body: '{ credential, evidence }' },
  { method: 'GET', path: '/api/v1/receipts/:receiptId', access: 'Public', body: 'None' },
  { method: 'GET', path: '/api/v1/credentials/:id', access: 'Public', body: 'None' },
  { method: 'POST', path: '/api/v1/credentials', access: 'Issuer auth', body: 'credential draft + evidence' },
  { method: 'POST', path: '/api/v1/credentials/:id/revoke', access: 'Issuer auth', body: 'None' },
  { method: 'GET', path: '/api/v1/issuers/:address', access: 'Public', body: 'None' },
]

const SDK_SNIPPET = `import { verifyOffline, ObsignClient } from '@obsign/sdk'

// Recompute a receipt locally — no network, no trust in Obsign's servers.
const offline = verifyOffline(credential, evidence, {
  now: new Date().toISOString(),
})
console.log(offline.result, offline.reasonCode, offline.receiptId)

// Or verify against a running Obsign API (x402-gated).
const client = new ObsignClient({ baseUrl: 'https://obsign.onrender.com' })
const receipt = await client.verify(credential, evidence)`

export default function DocsPage() {
  return (
    <main className="docs">
      <section className="docs__main section">
        <div className="container">
          <div className="docs__hero">
          <p className="eyebrow docs__eyebrow">Obsign documentation</p>
          <h1 className="docs__hero-title">Proof that can be <span className="script-accent">checked.</span></h1>
          <p className="docs__hero-lead">Obsign turns a real-world claim into a verifiable receipt. It gives people, applications, and autonomous agents a shared way to check what happened without relying on Obsign to be the final authority.</p>
          </div>
        </div>

        <div className="container docs__grid">
          <details className="docs__nav" aria-label="On this page" open>
            <summary className="docs__nav-title">On this page</summary>
            <ul>
              <li><a href="#what-is-obsign">What is Obsign?</a></li><li><a href="#how-it-works">How it works</a></li><li><a href="#receipt">The receipt</a></li><li><a href="#modules">Evidence modules</a></li><li><a href="#issuers">For issuers</a></li><li><a href="#api">API and integrations</a></li><li><a href="#trust">Trust model</a></li>
            </ul>
          </details>

          <div className="docs__content">
            <section id="what-is-obsign" className="docs__section">
              <p className="docs__kicker">Start here</p><h2 className="docs__section-title">What Obsign is</h2>
              <p className="docs__section-lead">Obsign is a multi-issuer credential platform for claims that need to hold up outside the system that created them. An issuer can say that someone attended an event, that an artifact is genuine, or that a chain event occurred. Obsign packages that claim with evidence a machine can check.</p>
              <p className="docs__body-copy">The output is a receipt. It is not a promise from our database. It is a deterministic result that can be recomputed from the published credential, evidence, and verification rules. That lets a holder share proof, an integrator make a decision, and an auditor inspect the result without asking Obsign for permission.</p>
              <div className="docs__callout"><h3>What Obsign does not do</h3><p>It does not decide whether a claim is socially true. It verifies whether the evidence attached to that claim satisfies a clear, published rule.</p></div>
            </section>

            <section id="how-it-works" className="docs__section">
              <p className="docs__kicker">The workflow</p><h2 className="docs__section-title">From claim to checkable proof</h2>
              <div className="docs__steps">
                <article className="docs__step"><span>01</span><div><h3>Issue</h3><p>An issuer creates a credential and attaches one form of machine-checkable evidence.</p></div></article>
                <article className="docs__step"><span>02</span><div><h3>Anchor</h3><p>The resulting receipt can be committed to Base, creating a public timestamp for the issued proof.</p></div></article>
                <article className="docs__step"><span>03</span><div><h3>Verify</h3><p>Anyone can verify through the app, API, SDK, MCP, or an independent offline implementation.</p></div></article>
              </div>
            </section>

            <section id="receipt" className="docs__section">
              <p className="docs__kicker">The shared result</p><h2 className="docs__section-title">A receipt anyone can recompute</h2>
              <p className="docs__section-lead">The receipt records the outcome of verification and the hashes needed to identify its inputs. The same credential and evidence always produce the same identifier, regardless of where verification runs.</p>
              <pre className="docs__code-block">{`credentialHash = keccak256(utf8(JCS(credential)))
evidenceHash   = keccak256(utf8(JCS(evidence)))
receiptId      = keccak256(concat(credentialHash, evidenceHash))`}</pre>
              <p className="docs__body-copy">JCS is the JSON Canonicalization Scheme defined by RFC 8785. It removes irrelevant formatting differences, such as object key order, before hashing. A verdict and reason code explain whether the evidence passed. Payment, request timing, and the requesting party cannot change the receipt identifier.</p>
            </section>

            <section id="modules" className="docs__section">
              <p className="docs__kicker">Evidence</p><h2 className="docs__section-title">Three ways to support a claim</h2><p className="docs__section-lead">Each credential uses one explicit verification module. That keeps the rule for passing or failing unambiguous.</p>
              <div className="docs__cards">{MODULES.map((module) => <article key={module.title} className="docs__card"><h3>{module.title}</h3><p>{module.body}</p></article>)}</div>
            </section>

            <section id="issuers" className="docs__section">
              <p className="docs__kicker">For issuers</p><h2 className="docs__section-title">Issue credentials with a verifiable trail</h2><p className="docs__section-lead">Obsign supports multiple issuers from day one. Issuers are registered onchain, credentials can be revoked when needed, and verification is charged per use instead of through a subscription.</p><Link className="docs__action" to="/app/issue">Open the issuer workspace</Link>
            </section>

            <section id="api" className="docs__section">
              <p className="docs__kicker">Build with Obsign</p><h2 className="docs__section-title">API, MCP, and SDK</h2><p className="docs__section-lead">Use the API for application workflows, MCP for agent workflows, or the SDK for typed and offline verification. Verification requests use x402 when payment is required, so software can pay per call without account setup.</p>
              <div className="docs__table-wrap"><table className="docs__table"><caption className="sr-only">Obsign HTTP API endpoints</caption><thead><tr><th>Method</th><th>Path</th><th>Access</th><th>Body</th></tr></thead><tbody>{API_ENDPOINTS.map((endpoint) => <tr key={endpoint.method + endpoint.path}><td><code>{endpoint.method}</code></td><td><code>{endpoint.path}</code></td><td>{endpoint.access}</td><td><code>{endpoint.body}</code></td></tr>)}</tbody></table></div>
              <h3 className="docs__sub-title">SDK example</h3><pre className="docs__code-block">{SDK_SNIPPET}</pre>
            </section>

            <section id="trust" className="docs__section">
              <p className="docs__kicker">Trust model</p><h2 className="docs__section-title">What you need to trust</h2>
              <ul className="docs__trust-list"><li><strong>The evidence rule.</strong> Every credential names the rule used to verify it.</li><li><strong>The inputs.</strong> Recompute the receipt from the credential and evidence you were given.</li><li><strong>The public chain state.</strong> Anchors and onchain evidence are evaluated against a pinned Base block.</li></ul>
              <p className="docs__body-copy">You do not need to trust an Obsign database, a private API response, or an AI model to reproduce the receipt.</p>
            </section>

          </div>
        </div>
      </section>
    </main>
  )
}

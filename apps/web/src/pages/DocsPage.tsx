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
          <p className="eyebrow docs__eyebrow">For AI agents, humans, applications, and auditors</p>
          <h1 className="docs__hero-title">Proof that every decision maker can <span className="script-accent">check.</span></h1>
          <p className="docs__hero-lead">Obsign gives AI agents and humans a shared way to verify claims, inspect evidence, pay for hosted checks when needed, and return receipts that remain independently auditable long after a decision has been made.</p>
          </div>
        </div>

        <div className="container docs__grid">
          <details className="docs__nav" aria-label="On this page" open>
            <summary className="docs__nav-title">On this page</summary>
            <ul>
              <li><a href="#agents-humans">For AI agents and humans</a></li><li><a href="#what-is-obsign">What is Obsign?</a></li><li><a href="#how-it-works">How it works</a></li><li><a href="#receipt">The receipt</a></li><li><a href="#modules">Evidence modules</a></li><li><a href="#issuers">For issuers</a></li><li><a href="#api">API, MCP, and x402</a></li><li><a href="#sentinel">Sentinel</a></li><li><a href="#usage">How agents and humans use Obsign</a></li><li><a href="#trust">Trust model</a></li>
            </ul>
          </details>

          <div className="docs__content">
            <section id="agents-humans" className="docs__section">
              <p className="docs__kicker">Agents first. Humans included.</p><h2 className="docs__section-title">Obsign for AI agents and humans</h2>
              <p className="docs__section-lead">Obsign is built for AI agents and humans who need to make decisions based on claims that can be checked. A claim might be that someone attended an event, a document is authentic, a wallet completed an onchain action, or several independent parties approved the same statement.</p>
              <p className="docs__body-copy">Instead of asking a decision maker to trust a screenshot, a badge, a private database, or an AI-generated explanation, Obsign combines a credential with machine-checkable evidence and produces a deterministic receipt.</p>
              <p className="docs__body-copy">AI agents can use that receipt before granting access, approving a workflow, releasing a benefit, or continuing an automated process. Humans can use the same receipt to verify a claim, understand why it passed or failed, and share evidence with an auditor or another organization.</p>
            </section>

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
              <p className="docs__kicker">For issuers</p><h2 className="docs__section-title">Issue credentials with a verifiable trail</h2><p className="docs__section-lead">Obsign supports multiple issuers from day one. Issuers are registered onchain, credentials can be revoked when needed, and verification is charged per use instead of through a subscription.</p>
              <p className="docs__body-copy">AI agents can prepare credential workflows, but a user-controlled wallet or an explicitly approved signing service must authorize issuance. An agent never silently controls an issuer private key. Revocation creates a deterministic future verification result instead of silently deleting history.</p>
              <Link className="docs__action" to="/app/issue">Open the issuer workspace</Link>
            </section>

            <section id="api" className="docs__section">
              <p className="docs__kicker">Build with Obsign</p><h2 className="docs__section-title">API, MCP, and SDK</h2><p className="docs__section-lead">Use the API for application workflows, MCP for agent workflows, or the SDK for typed and offline verification. Verification requests use x402 when payment is required, so software can pay per call without account setup.</p>
              <div className="docs__table-wrap"><table className="docs__table"><caption className="sr-only">Obsign HTTP API endpoints</caption><thead><tr><th>Method</th><th>Path</th><th>Access</th><th>Body</th></tr></thead><tbody>{API_ENDPOINTS.map((endpoint) => <tr key={endpoint.method + endpoint.path}><td><code>{endpoint.method}</code></td><td><code>{endpoint.path}</code></td><td>{endpoint.access}</td><td><code>{endpoint.body}</code></td></tr>)}</tbody></table></div>
              <h3 className="docs__sub-title">SDK example</h3><pre className="docs__code-block">{SDK_SNIPPET}</pre>
              <h3 id="mcp" className="docs__sub-title">MCP tools for AI agents</h3>
              <p className="docs__body-copy">The MCP endpoint (<code>POST /api/mcp</code>) exposes four tools: <code>obsign_verify</code> to verify a credential and evidence and return a recomputable receipt, <code>obsign_issue</code> to persist a self-signed credential and enqueue anchoring, <code>obsign_get_receipt</code> to fetch a cached receipt by id, and <code>obsign_get_issuer</code> to fetch a known issuer by address.</p>
              <h3 className="docs__sub-title">x402 payment flow</h3>
              <p className="docs__body-copy">Hosted verification follows an x402 flow: request, 402 challenge, approved payment, retry with proof, deterministic receipt. Payment grants access to hosted verification and never changes the validity result or the receipt identifier. Each proof is single-use, and the payment is sent to the configured Obsign service payee, not to any agent.</p>
            </section>

            <section id="sentinel" className="docs__section">
              <p className="docs__kicker">Sentinel and the trust model</p><h2 className="docs__section-title">An auditable vetting agent</h2>
              <p className="docs__section-lead">Sentinel is Obsign’s autonomous vetting agent. It makes agent-assisted decisions auditable by recording the goal, plan, tool calls, payment status, verification receipt, policy evaluation, and final grant or denial.</p>
              <p className="docs__body-copy">In the web console a live Sentinel run is gated behind wallet sign-in (SIWE): a signed-in user picks a credential and the agent pays for permitted hosted verification over x402, evaluates the policy, and anchors a signed report on Base. Server or cron callers may instead present the run secret. A live run requires a fully configured, funded agent wallet, and the payment recipient remains the configured Obsign service payee, not Sentinel itself. A simulation mode that produces a real deterministic verdict from the offline core — moving no funds and broadcasting no transaction — remains available for testing.</p>
              <p className="docs__body-copy">Obsign keeps a firm trust boundary. An AI model can explain a result or follow a policy, but it does not determine cryptographic validity. Validity comes from the deterministic verifier and its evidence rules.</p>
            </section>

            <section id="usage" className="docs__section">
              <p className="docs__kicker">In practice</p><h2 className="docs__section-title">How AI agents and humans use Obsign</h2>
              <p className="docs__section-lead">Both audiences rely on the same receipts, from different entry points.</p>
              <h3 className="docs__sub-title">AI agents can use Obsign to</h3>
              <ul className="docs__trust-list">
                <li>Verify credentials before granting access or releasing a benefit.</li>
                <li>Check artifact hashes before using a document or dataset in a workflow.</li>
                <li>Verify onchain actions before continuing an automated process.</li>
                <li>Inspect expiry and revocation status before relying on a credential.</li>
                <li>Retrieve a reason code and explain a policy decision to a human.</li>
                <li>Complete approved x402 payments for hosted verification.</li>
                <li>Prepare credential issuance requests when granted explicit signing authority.</li>
              </ul>
              <h3 className="docs__sub-title">Humans can use Obsign to</h3>
              <ul className="docs__trust-list">
                <li>Issue credentials for attendance, membership, roles, artifacts, and onchain events.</li>
                <li>Verify credentials before approving access, benefits, records, or documents.</li>
                <li>Share receipts with teams, partners, auditors, customers, or other organizations.</li>
                <li>Understand why a credential passed or failed through its reason code.</li>
                <li>Confirm that a credential is active, valid, and not revoked.</li>
                <li>Independently verify a claim without trusting the issuer’s private database.</li>
              </ul>
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

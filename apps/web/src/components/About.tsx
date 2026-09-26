import { Link } from '../lib/router'
import './About.css'

export default function About() {
  return (
    <section className="about section" aria-labelledby="about-title">
      <div className="container">
        <article className="about__card">
          <span className="about__quote" aria-hidden="true">“</span>
          <div className="about__content">
            <p className="eyebrow about__eyebrow">About Obsign</p>
            <h2 id="about-title" className="about__title">
              Proof infrastructure for decisions that need to{' '}
              <span className="script-accent">hold up.</span>
            </h2>
            <p className="about__lead">
              Obsign gives AI agents and humans a dependable way to check a claim before acting on
              it. It turns a credential and its supporting evidence into a deterministic receipt, so
              the result can be verified again by another agent, another application, a team member,
              or an independent auditor.
            </p>
            <p className="about__body">
              AI agents can use Obsign through MCP, the API, or the SDK to verify credentials, read
              receipts, inspect issuers, and, when they have explicit approval, record credentials
              with self-signed and onchain-anchored proof. Humans can use the same tools through the
              web app to issue, verify, share, and audit credentials without relying on a private
              database or a black-box decision.
            </p>
            <p className="about__body">
              Sentinel is Obsign’s autonomous vetting agent. It receives a goal, inspects available
              evidence, calls verification tools, handles approved payment steps, evaluates a policy,
              and records an auditable trace of the final grant or denial. In the web console a
              signed-in user picks a credential and the agent runs it live: it pays over x402,
              verifies through the deterministic core, evaluates the policy, and anchors a signed
              report on Base. Live runs are gated behind wallet sign-in and require a funded agent
              wallet.
            </p>
            <Link className="btn btn--primary about__action" to="/app/docs#what-is-obsign">
              Read more
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}

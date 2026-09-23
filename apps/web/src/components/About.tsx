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
              Infrastructure for proof that <span className="script-accent">holds up.</span>
            </h2>
            <p className="about__lead">
              Obsign is verifiable-credential infrastructure for claims that need to travel
              beyond the system that created them. It turns a claim and its evidence into a
              deterministic receipt that people, applications, and agents can recompute.
            </p>
            <p className="about__body">
              Anchors on Base provide a public timestamp, while the API, SDK, and MCP make
              verification available wherever a decision is made. Sentinel is Obsign’s
              emerging vetting layer: it can inspect published rules and evidence without
              becoming the authority on whether a claim is true.
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

import './Modules.css'

const MODULES = [
  {
    icon: '✕',
    title: 'Quorum of signers',
    desc: 'Valid only once enough independent co-signers approve the same message, so the claim reflects real agreement.',
    example: 'Attendance confirmed by several organizers.',
  },
  {
    icon: '⬡',
    title: 'On-chain event',
    desc: 'Confirms a transaction or log exists on Base, checked against a pinned block so everyone gets the same result.',
    example: 'A pinned token transfer with confirmations.',
  },
  {
    icon: '▤',
    title: 'Artifact hash',
    desc: 'Refetches a file and recomputes its hash to confirm it matches the credential byte for byte.',
    example: 'The SHA-256 checksum of a published file.',
  },
]

export default function Modules() {
  return (
    <section id="modules" className="section modules">
      <div className="container">
        <div className="modules__head">
          <p className="eyebrow">The evidence modules</p>
          <h2 className="section-title">
            Three rigorous ways to <span className="script-accent">prove it.</span>
          </h2>
          <p className="section-lead">
            Every credential backs its claim with evidence a machine can check. The core
            evaluates exactly one module per artifact, which keeps each verdict easy to audit.
          </p>
        </div>

        <div className="modules__grid">
          {MODULES.map((m) => (
            <article key={m.title} className="module-card">
              <span className="module-card__icon" aria-hidden="true">
                {m.icon}
              </span>
              <h3 className="module-card__title">{m.title}</h3>
              <p className="module-card__desc">{m.desc}</p>
              <p className="module-card__example">
                <span className="module-card__tag">In practice</span> {m.example}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

import './Modules.css'

const MODULES = [
  {
    icon: '✕',
    title: 'Quorum',
    desc: 'A credential is valid only when a threshold of co-signers approve the same message.',
    example: 'Co-signed attendance attestations',
  },
  {
    icon: '⬡',
    title: 'Onchain event',
    desc: 'Verifies a pinned transaction or log on Base — never against latest.',
    example: 'Pinned Transfer event with confirmations',
  },
  {
    icon: '▤',
    title: 'Artifact hash',
    desc: 'Recomputes the hash of a fetched artifact and compares it byte-for-byte.',
    example: 'SHA-256 checksum of an image or file',
  },
]

export default function Modules() {
  return (
    <section id="modules" className="section modules">
      <div className="container">
        <div className="modules__head">
          <p className="eyebrow">Verifier modules</p>
          <h2 className="section-title">
            Three ways to <span className="script-accent">prove it.</span>
          </h2>
          <p className="section-lead">
            Every credential must back its claim with machine-checkable evidence.
            The deterministic core evaluates exactly one of these modules per artifact.
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
                <span className="module-card__tag">Example</span> {m.example}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
